export function createInvitationDocId(ledgerId, email) {
  return `${ledgerId}__${email.trim().toLowerCase()}`;
}
