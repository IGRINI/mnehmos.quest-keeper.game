export function getRuntimePlatform(): string {
    if (typeof navigator === 'undefined') return '';

    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return [
        nav.userAgentData?.platform,
        nav.platform,
        nav.userAgent,
    ].filter(Boolean).join(' ');
}

export function isWindowsRuntime(): boolean {
    return /\bwin/i.test(getRuntimePlatform());
}

export function errorToMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}
