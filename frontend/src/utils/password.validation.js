export const getPasswordError = (password) => {
  if ([...password].length < 12) {
    return "Use at least 12 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Include at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Include at least one lowercase letter.";
  }

  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return "Include at least one special character.";
  }

  return "";
};
