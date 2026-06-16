import type { CharacterType, MemberRole } from '../../stores/partyStore';

const MEMBER_ROLE_LABELS: Record<string, string> = {
  leader: 'Лидер',
  member: 'Участник',
  companion: 'Спутник',
  hireling: 'Наемник',
  prisoner: 'Пленник',
  mount: 'Ездовое',
};

const CHARACTER_TYPE_LABELS: Record<string, string> = {
  pc: 'Персонаж игрока',
  npc: 'НПС',
  neutral: 'Нейтральный',
  enemy: 'Враг',
};

const PARTY_STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  dormant: 'Неактивна',
  archived: 'В архиве',
};

export const getMemberRoleLabel = (role: MemberRole | string | null | undefined): string => {
  if (!role) return '';
  return MEMBER_ROLE_LABELS[role] ?? role;
};

export const getCharacterTypeLabel = (type: CharacterType | string | null | undefined): string => {
  if (!type) return '';
  return CHARACTER_TYPE_LABELS[type] ?? type;
};

export const getPartyStatusLabel = (status: string | null | undefined): string => {
  if (!status) return '';
  return PARTY_STATUS_LABELS[status] ?? status;
};
