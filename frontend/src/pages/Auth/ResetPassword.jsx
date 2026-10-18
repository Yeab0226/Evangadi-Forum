import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, MessageSquare } from "lucide-react";
import { authService } from "../../services/auth/auth.service";
import styles from "./Auth.module.css";
import { getPasswordError } from "../../utils/password.validation";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid or expired reset link.");
      return;
    }
    const passwordError = getPasswordError(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await authService.resetPassword(token, password);
      setMessage(result.message);
      setTimeout(() => navigate("/auth"), 1200);
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.auth}>
      <section className={styles.auth__info}>
        <div className={styles.auth__infoContent}>
          <div
            className={styles.auth__infoBranding}
            onClick={() => navigate("/")}
          >
            <div className={styles.auth__infoLogo} aria-hidden>
              <MessageSquare size={22} />
            </div>
            <div className={styles.auth__infoBrandCopy}>
              <p className={styles.auth__infoTitle}>Evangadi Forum</p>
              <p className={styles.auth__infoTagline}>
                Learn together. Ask with context.
              </p>
            </div>
          </div>
          <p className={styles.auth__infoDescription}>
            Create a new password for your Evangadi Forum account.
          </p>
        </div>
      </section>

      <section className={styles.auth__formSection}>
        <div className={styles.auth__formContainer}>
          <div className={styles.auth__formHeader}>
            <h2 className={styles.auth__formTitle}>Create a new password</h2>
          </div>

          <form className={styles.auth__form} onSubmit={handleSubmit}>
            <div className={styles.auth__inputGroup}>
              <label htmlFor="password" className={styles.auth__label}>
                New Password
              </label>
              <div className={styles.auth__passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={`${styles.auth__input} ${styles.auth__inputPassword}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.auth__passwordToggle}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p
                style={{ fontSize: "13px", color: "#596579", lineHeight: 1.6 }}
              >
                Use at least 12 characters, including an uppercase letter, a
                lowercase letter, and a special character.
              </p>
            </div>

            <div className={styles.auth__inputGroup}>
              <label htmlFor="confirmPassword" className={styles.auth__label}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={styles.auth__input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {message && <div className={styles.auth__success}>{message}</div>}
            {error && <div className={styles.auth__error}>{error}</div>}

            <div className={styles.auth__buttonContainer}>
              <button
                type="submit"
                className={`${styles.auth__button} ${styles["auth__button--primary"]}`}
                disabled={loading}
              >
                {loading ? "Updating..." : "Reset Password"}
                {!loading && (
                  <ArrowRight size={16} className={styles.auth__buttonIcon} />
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
