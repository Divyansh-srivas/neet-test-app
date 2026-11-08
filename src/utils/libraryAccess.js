// Library is a paid feature. It is unlocked for: admins/bypass accounts, everyone while the paywall is off,
// and anyone with a paid plan that has not expired (even if all extraction credits are used up).
export const isLibraryUnlocked = (status) =>
  !!status && (status.unlimited === true || status.paywallEnabled === false || status.planActive === true)
