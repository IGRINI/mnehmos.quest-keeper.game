use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

mod oauth;

const RESPONSES_ENDPOINT: &str = "https://chatgpt.com/backend-api/codex/responses";
const CODEX_ORIGINATOR: &str = "codex_cli_rs";
const CODEX_USER_AGENT: &str = "codex_cli_rs/0.133.0 (Quest Keeper AI)";
const SSE_IDLE_TIMEOUT: Duration = Duration::from_secs(45);
const MAX_SSE_LINE_BYTES: usize = 1024 * 1024;
const STREAM_DELTA_EVENT: &str = "codex-response-delta";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAuthStatus {
    authenticated: bool,
    account_id: Option<String>,
    expires_at: Option<u64>,
    message: String,
}

impl CodexAuthStatus {
    fn missing() -> Self {
        Self {
            authenticated: false,
            account_id: None,
            expires_at: None,
            message: "Codex OAuth не авторизован".to_string(),
        }
    }

    fn from_credential(credential: &oauth::CodexCredential) -> Self {
        Self {
            authenticated: true,
            account_id: credential.account_id.clone(),
            expires_at: credential.expires_at,
            message: "Codex OAuth авторизован".to_string(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexChatRequest {
    model: String,
    messages: Vec<CodexChatMessage>,
    #[serde(default)]
    tools: Vec<Value>,
    #[serde(default, rename = "streamEventId")]
    stream_event_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CodexChatMessage {
    role: String,
    content: String,
    #[serde(default, rename = "toolCalls")]
    tool_calls: Vec<CodexToolCall>,
    #[serde(default, rename = "toolCallId")]
    tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CodexToolCall {
    #[serde(default)]
    id: Option<String>,
    name: String,
    arguments: Value,
}

#[derive(Debug, Deserialize)]
struct CodexToolCallWire {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<Value>,
    #[serde(default)]
    function: Option<CodexToolCallFunctionWire>,
}

#[derive(Debug, Deserialize)]
struct CodexToolCallFunctionWire {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<Value>,
}

impl<'de> Deserialize<'de> for CodexToolCall {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let wire = CodexToolCallWire::deserialize(deserializer)?;
        let (function_name, function_arguments) = wire
            .function
            .map(|function| (function.name, function.arguments))
            .unwrap_or((None, None));

        Ok(Self {
            id: wire.id,
            name: wire.name.or(function_name).unwrap_or_default(),
            arguments: wire
                .arguments
                .or(function_arguments)
                .unwrap_or_else(|| json!({})),
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexChatResponse {
    content: String,
    tool_calls: Vec<CodexToolCall>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexStreamDeltaPayload<'a> {
    stream_id: &'a str,
    delta: &'a str,
}

#[tauri::command]
pub async fn codex_auth_status(app: AppHandle) -> Result<CodexAuthStatus, String> {
    let credential = oauth::load_credential(&app)?;
    Ok(match credential {
        Some(credential) => CodexAuthStatus::from_credential(&credential),
        None => CodexAuthStatus::missing(),
    })
}

#[tauri::command]
pub async fn codex_authenticate(app: AppHandle) -> Result<CodexAuthStatus, String> {
    let client = http_client()?;
    let credential = oauth::run_oauth(&client).await?;
    oauth::save_credential(&app, &credential)?;
    Ok(CodexAuthStatus::from_credential(&credential))
}

#[tauri::command]
pub async fn codex_logout(app: AppHandle) -> Result<CodexAuthStatus, String> {
    if let Some(credential) = oauth::load_credential(&app)? {
        let client = http_client()?;
        let _ = oauth::revoke_credential(&client, &credential).await;
    }
    oauth::delete_credential(&app)?;
    Ok(CodexAuthStatus::missing())
}

#[tauri::command]
pub async fn codex_send_message(
    app: AppHandle,
    request: CodexChatRequest,
) -> Result<CodexChatResponse, String> {
    let client = http_client()?;
    let credential = oauth::ensure_fresh_credential(&app, &client).await?;
    let body = build_request(&request);

    let mut http_request = client
        .post(RESPONSES_ENDPOINT)
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .json(&body);

    for (name, value) in auth_headers(&credential) {
        http_request = http_request.header(name, value);
    }

    let response = http_request
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.map_err(|error| error.to_string())?;
        return Err(redacted_provider_error(status.as_u16(), &text));
    }

    let chat_response =
        collect_response_stream(response, &app, request.stream_event_id.as_deref()).await?;
    if chat_response.content.trim().is_empty() && chat_response.tool_calls.is_empty() {
        return Err("Codex вернул пустой ответ".to_string());
    }

    Ok(chat_response)
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())
}

fn auth_headers(credential: &oauth::CodexCredential) -> Vec<(&'static str, String)> {
    let mut headers = vec![
        (
            "Authorization",
            format!("Bearer {}", credential.access_token.trim()),
        ),
        ("originator", CODEX_ORIGINATOR.to_string()),
        ("User-Agent", CODEX_USER_AGENT.to_string()),
    ];
    if let Some(account_id) = credential
        .account_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        headers.push(("ChatGPT-Account-Id", account_id.to_string()));
    }
    headers
}

fn build_request(request: &CodexChatRequest) -> Value {
    let instructions = instructions_from_messages(&request.messages);
    let input = input_from_messages(&request.messages);

    let mut body = json!({
        "model": request.model,
        "instructions": instructions,
        "input": input,
        "stream": true,
        "store": false,
    });

    if !request.tools.is_empty() {
        if let Some(object) = body.as_object_mut() {
            object.insert("tools".to_string(), Value::Array(request.tools.clone()));
            object.insert("tool_choice".to_string(), Value::String("auto".to_string()));
            object.insert("parallel_tool_calls".to_string(), Value::Bool(true));
        }
    }

    body
}

fn instructions_from_messages(messages: &[CodexChatMessage]) -> String {
    let instructions = messages
        .iter()
        .filter(|message| message.role == "system")
        .map(|message| message.content.trim())
        .filter(|content| !content.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");

    if instructions.trim().is_empty() {
        "You are Quest Keeper AI's dungeon master.".to_string()
    } else {
        instructions
    }
}

fn input_from_messages(messages: &[CodexChatMessage]) -> Vec<Value> {
    let mut input = Vec::new();

    for message in messages.iter().filter(|message| message.role != "system") {
        match message.role.as_str() {
            "tool" => {
                if let Some(call_id) = message.tool_call_id.as_deref() {
                    input.push(json!({
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": message.content,
                    }));
                }
            }
            "assistant" => {
                if !message.content.trim().is_empty() {
                    input.push(chat_message_input_item(
                        "assistant",
                        "output_text",
                        &message.content,
                    ));
                }
                for tool_call in &message.tool_calls {
                    if let Some(item) = function_call_input_item(tool_call) {
                        input.push(item);
                    }
                }
            }
            "user" => {
                if !message.content.trim().is_empty() {
                    input.push(chat_message_input_item(
                        "user",
                        "input_text",
                        &message.content,
                    ));
                }
            }
            _ => {}
        }
    }

    input
}

fn chat_message_input_item(role: &str, kind: &str, content: &str) -> Value {
    json!({
        "role": role,
        "content": [{ "type": kind, "text": content }],
    })
}

fn function_call_input_item(tool_call: &CodexToolCall) -> Option<Value> {
    let name = tool_call.name.trim();
    if name.is_empty() {
        return None;
    }

    let arguments = if tool_call.arguments.is_string() {
        tool_call.arguments.as_str().unwrap_or_default().to_string()
    } else {
        tool_call.arguments.to_string()
    };

    Some(json!({
        "type": "function_call",
        "call_id": tool_call
            .id
            .clone()
            .unwrap_or_else(|| format!("call_{name}")),
        "name": name,
        "arguments": arguments,
    }))
}

async fn collect_response_stream(
    mut response: reqwest::Response,
    app: &AppHandle,
    stream_event_id: Option<&str>,
) -> Result<CodexChatResponse, String> {
    let mut decoder = SseDecoder::default();
    let mut content = String::new();
    let mut tool_calls = ToolCallAccumulator::default();
    let mut completed_tool_calls = Vec::new();

    loop {
        let chunk = tokio::time::timeout(SSE_IDLE_TIMEOUT, response.chunk())
            .await
            .map_err(|_| format!("Codex SSE stream idle for more than {SSE_IDLE_TIMEOUT:?}"))?
            .map_err(|error| error.to_string())?;

        let Some(chunk) = chunk else {
            break;
        };

        for payload in decoder.push(chunk.as_ref())? {
            if payload == "[DONE]" {
                return Ok(finish_stream_response(
                    content,
                    tool_calls,
                    completed_tool_calls,
                ));
            }

            let event = serde_json::from_str::<Value>(&payload)
                .map_err(|error| format!("Codex вернул некорректное SSE событие: {error}"))?;

            if !handle_stream_event(
                &event,
                &mut content,
                &mut tool_calls,
                &mut completed_tool_calls,
                app,
                stream_event_id,
            )? {
                return Ok(finish_stream_response(
                    content,
                    tool_calls,
                    completed_tool_calls,
                ));
            }
        }
    }

    Ok(finish_stream_response(
        content,
        tool_calls,
        completed_tool_calls,
    ))
}

fn finish_stream_response(
    content: String,
    tool_calls: ToolCallAccumulator,
    completed_tool_calls: Vec<CodexToolCall>,
) -> CodexChatResponse {
    let mut calls = tool_calls.finish();
    if calls.is_empty() {
        calls = completed_tool_calls;
    }
    CodexChatResponse {
        content,
        tool_calls: calls,
    }
}

fn handle_stream_event(
    event: &Value,
    content: &mut String,
    tool_calls: &mut ToolCallAccumulator,
    completed_tool_calls: &mut Vec<CodexToolCall>,
    app: &AppHandle,
    stream_event_id: Option<&str>,
) -> Result<bool, String> {
    match event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "response.output_text.delta" => {
            if let Some(delta) = event.get("delta").and_then(Value::as_str) {
                content.push_str(delta);
                emit_stream_delta(app, stream_event_id, delta);
            }
        }
        "response.output_item.added" => {
            if let Some(item) = event.get("item") {
                if item.get("type").and_then(Value::as_str) == Some("function_call") {
                    tool_calls.merge_item(item, output_index(event));
                }
            }
        }
        "response.function_call_arguments.delta" => {
            tool_calls.merge_arguments_delta(
                output_index(event),
                event.get("item_id").and_then(Value::as_str),
                event
                    .get("delta")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            );
        }
        "response.function_call_arguments.done" => {
            if let Some(item) = event.get("item") {
                tool_calls.merge_item(item, output_index(event));
            } else {
                tool_calls.merge_top_level_done(event);
            }
        }
        "response.output_item.done" => {
            if let Some(item) = event.get("item") {
                if item.get("type").and_then(Value::as_str) == Some("function_call") {
                    tool_calls.merge_item(item, output_index(event));
                }
            }
        }
        "response.completed" => {
            if let Some(response) = event.get("response") {
                if content.is_empty() {
                    content.push_str(&extract_output_text(response));
                }
                if completed_tool_calls.is_empty() {
                    *completed_tool_calls = extract_tool_calls(response);
                }
            }
            return Ok(false);
        }
        "response.failed" | "error" => {
            return Err(response_error_message(event));
        }
        "response.reasoning_summary_text.delta"
        | "response.reasoning_text.delta"
        | "response.reasoning_summary.delta" => {}
        _ => {}
    }

    Ok(true)
}

fn emit_stream_delta(app: &AppHandle, stream_event_id: Option<&str>, delta: &str) {
    let Some(stream_id) = stream_event_id else {
        return;
    };
    if delta.is_empty() {
        return;
    }

    let _ = app.emit(
        STREAM_DELTA_EVENT,
        CodexStreamDeltaPayload { stream_id, delta },
    );
}

fn response_error_message(event: &Value) -> String {
    event
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| {
            event
                .get("response")
                .and_then(|response| response.get("error"))
                .and_then(|error| error.get("message"))
                .and_then(Value::as_str)
        })
        .or_else(|| {
            event
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(Value::as_str)
        })
        .unwrap_or("Codex stream failed")
        .to_string()
}

fn output_index(value: &Value) -> usize {
    value
        .get("output_index")
        .and_then(Value::as_u64)
        .map(|index| index as usize)
        .unwrap_or(0)
}

#[derive(Default)]
struct SseDecoder {
    buffer: Vec<u8>,
}

impl SseDecoder {
    fn push(&mut self, chunk: &[u8]) -> Result<Vec<String>, String> {
        self.buffer.extend_from_slice(chunk);
        reject_oversized_pending_line(&self.buffer)?;

        let mut payloads = Vec::new();
        while let Some(newline) = self.buffer.iter().position(|byte| *byte == b'\n') {
            if newline > MAX_SSE_LINE_BYTES {
                return Err(format!(
                    "Codex SSE line exceeded {MAX_SSE_LINE_BYTES} bytes"
                ));
            }

            let line = self.buffer.drain(..=newline).collect::<Vec<_>>();
            let line = String::from_utf8_lossy(&line[..line.len().saturating_sub(1)]);
            let line = line.trim_end_matches('\r').trim();
            if let Some(payload) = line.strip_prefix("data:") {
                let payload = payload.trim();
                if !payload.is_empty() {
                    payloads.push(payload.to_string());
                }
            }
        }

        reject_oversized_pending_line(&self.buffer)?;
        Ok(payloads)
    }
}

fn reject_oversized_pending_line(buffer: &[u8]) -> Result<(), String> {
    if buffer.len() > MAX_SSE_LINE_BYTES && !buffer.contains(&b'\n') {
        return Err(format!(
            "Codex SSE line exceeded {MAX_SSE_LINE_BYTES} bytes without newline"
        ));
    }
    Ok(())
}

#[derive(Default)]
struct ToolCallAccumulator {
    calls: Vec<PartialToolCall>,
}

#[derive(Default)]
struct PartialToolCall {
    item_id: Option<String>,
    output_index: usize,
    call_id: Option<String>,
    name: Option<String>,
    arguments: String,
}

impl ToolCallAccumulator {
    fn merge_item(&mut self, item: &Value, output_index: usize) {
        let call = self.find_or_create(output_index, item.get("id").and_then(Value::as_str));
        if let Some(item_id) = item.get("id").and_then(Value::as_str) {
            if !item_id.is_empty() {
                call.item_id = Some(item_id.to_string());
            }
        }
        if let Some(call_id) = item.get("call_id").and_then(Value::as_str) {
            if !call_id.is_empty() {
                call.call_id = Some(call_id.to_string());
            }
        }
        if let Some(name) = item.get("name").and_then(Value::as_str) {
            if !name.is_empty() {
                call.name = Some(name.to_string());
            }
        }
        if let Some(arguments) = item.get("arguments").and_then(Value::as_str) {
            call.arguments = arguments.to_string();
        }
    }

    fn merge_top_level_done(&mut self, event: &Value) {
        let call = self.find_or_create(
            output_index(event),
            event.get("item_id").and_then(Value::as_str),
        );
        if let Some(arguments) = event.get("arguments").and_then(Value::as_str) {
            call.arguments = arguments.to_string();
        }
        if let Some(call_id) = event.get("call_id").and_then(Value::as_str) {
            call.call_id = Some(call_id.to_string());
        }
        if let Some(name) = event.get("name").and_then(Value::as_str) {
            call.name = Some(name.to_string());
        }
    }

    fn merge_arguments_delta(&mut self, output_index: usize, item_id: Option<&str>, delta: &str) {
        let call = self.find_or_create(output_index, item_id);
        call.arguments.push_str(delta);
    }

    fn finish(mut self) -> Vec<CodexToolCall> {
        self.calls.sort_by_key(|call| call.output_index);
        self.calls
            .into_iter()
            .filter_map(|call| {
                let name = call.name?;
                if name.trim().is_empty() {
                    return None;
                }
                let raw_arguments = call.arguments;
                let arguments = serde_json::from_str(&raw_arguments).unwrap_or_else(|_| json!({}));
                let id = call
                    .call_id
                    .or_else(|| Some(format!("responses_call_{}", call.output_index)));
                Some(CodexToolCall {
                    id,
                    name,
                    arguments,
                })
            })
            .collect()
    }

    fn find_or_create(
        &mut self,
        output_index: usize,
        item_id: Option<&str>,
    ) -> &mut PartialToolCall {
        if let Some(item_id) = item_id {
            if let Some(position) = self
                .calls
                .iter()
                .position(|call| call.item_id.as_deref() == Some(item_id))
            {
                return &mut self.calls[position];
            }
        }

        if let Some(position) = self
            .calls
            .iter()
            .position(|call| call.output_index == output_index)
        {
            return &mut self.calls[position];
        }

        self.calls.push(PartialToolCall {
            output_index,
            item_id: item_id.map(ToOwned::to_owned),
            ..PartialToolCall::default()
        });
        self.calls.last_mut().expect("tool call was inserted")
    }
}

fn extract_output_text(value: &Value) -> String {
    let mut text = String::new();
    if let Some(output) = value.get("output").and_then(Value::as_array) {
        for item in output {
            if let Some(content) = item.get("content").and_then(Value::as_array) {
                for part in content {
                    if part.get("type").and_then(Value::as_str) == Some("output_text") {
                        if let Some(chunk) = part.get("text").and_then(Value::as_str) {
                            text.push_str(chunk);
                        }
                    }
                }
            }
        }
    }
    if text.is_empty() {
        if let Some(flat) = value.get("output_text").and_then(Value::as_str) {
            text.push_str(flat);
        }
    }
    text
}

fn extract_tool_calls(value: &Value) -> Vec<CodexToolCall> {
    value
        .get("output")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
        .filter_map(|(index, item)| {
            if item.get("type").and_then(Value::as_str) != Some("function_call") {
                return None;
            }
            let name = item.get("name").and_then(Value::as_str)?.to_string();
            if name.trim().is_empty() {
                return None;
            }
            let raw_arguments = item
                .get("arguments")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let arguments = serde_json::from_str(raw_arguments).unwrap_or_else(|_| json!({}));
            let id = item
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .or_else(|| Some(format!("responses_call_{index}")));
            Some(CodexToolCall {
                id,
                name,
                arguments,
            })
        })
        .collect()
}

fn redacted_provider_error(status: u16, body: &str) -> String {
    let mut compact = body.replace('\n', " ");
    if compact.len() > 2_000 {
        compact.truncate(2_000);
        compact.push_str("...");
    }
    format!("Ошибка Codex API {status}: {compact}")
}

pub fn credential_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("codex-oauth.json"))
}
