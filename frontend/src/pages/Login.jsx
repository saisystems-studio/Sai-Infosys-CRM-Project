import { useState } from "react";
import "../styles/Login.css";

const Icon = ({ name, size = 18 }) => {
  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M6.3 6.3C3.9 8 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

function Login({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

      const response = await fetch(`${apiUrl}/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Unable to sign in.");
      }

      onLogin(data);
    } catch (requestError) {
      setError(
        requestError.message === "Failed to fetch"
          ? "Cannot connect to the server. Please make sure the Django backend is running."
          : requestError.message,
      );
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <main className="login-shell">
      <section
        className="brand-panel"
        aria-label="Sai Infosys CRM introduction"
      >
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <header className="brand-lockup">
          <div className="logo-mark">SI</div>
          <div>
            <strong>Sai Infosys</strong>
            <span>Customer intelligence</span>
          </div>
        </header>

        <div className="brand-copy">
          <div className="eyebrow">
            <Icon name="spark" size={15} /> Built for modern sales teams
          </div>
          <h1>
            Turn every connection into <em>momentum.</em>
          </h1>
          <p>
            Bring your leads, conversations, and revenue into one intelligent
            workspace.
          </p>
        </div>

        <div className="insight-card">
          <div className="insight-head">
            <span>Revenue overview</span>
            <span className="live-dot">Live</span>
          </div>
          <div className="insight-value">
            ₹24.8L <span>+18.4%</span>
          </div>
          <svg
            className="chart"
            viewBox="0 0 420 86"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9b8cff" stopOpacity=".35" />
                <stop offset="1" stopColor="#9b8cff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="chart-area"
              d="M0 76 C35 67 46 70 74 54 S118 62 150 44 194 54 228 34 272 46 306 25 354 35 420 8 V86 H0Z"
            />
            <path
              className="chart-line"
              d="M0 76 C35 67 46 70 74 54 S118 62 150 44 194 54 228 34 272 46 306 25 354 35 420 8"
            />
          </svg>
          <div className="team-row">
            <div className="avatars">
              <span>AK</span>
              <span>RM</span>
              <span>PS</span>
            </div>
            <p>
              <strong>3 team members</strong>
              <br />
              closed deals today
            </p>
          </div>
        </div>

        <div className="trust-line">
          <Icon name="shield" size={16} />
          <span>Enterprise-grade security</span>
          <i />
          99.9% uptime
        </div>
      </section>

      <section className="form-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="logo-mark">SI</div>
            <strong>Sai Infosys</strong>
          </div>
          <div className="welcome">
            <span className="welcome-kicker">Welcome back</span>
            <h2>Sign in to your account</h2>
            <p>Enter your details to access your CRM workspace.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}
            <div className="input-group">
              <label htmlFor="email">Work email</label>
              <div className="input-wrap">
                <Icon name="mail" />
                <input
                  id="email"
                  type="text"
                  placeholder="Email or username"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            <div className="input-group">
              <div className="label-row">
                <label htmlFor="password">Password</label>
                <a href="#forgot">Forgot password?</a>
              </div>
              <div className="input-wrap">
                <Icon name="lock" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} />
                </button>
              </div>
            </div>
            <label className="remember">
              <input type="checkbox" />
              <span className="checkmark" />
              Keep me signed in
            </label>
            <button className="btn-signin" type="submit" disabled={isLoading}>
              <span>
                {isLoading ? "Signing in..." : "Sign in to workspace"}
              </span>
              {isLoading ? (
                <i className="login-spinner" />
              ) : (
                <Icon name="arrow" />
              )}
            </button>
          </form>

          <div className="divider">
            <span>or continue with</span>
          </div>
          <button className="btn-sso" type="button">
            <span className="sso-mark">S</span>Company SSO
          </button>
          <p className="signup-helper">
            New to Sai Infosys?{" "}
            <a href="#contact">Contact your administrator</a>
          </p>
        </div>
        <footer>
          © 2026 Sai Infosys <span>•</span> Privacy <span>•</span> Help
        </footer>
      </section>
    </main>
  );
}

export default Login;
