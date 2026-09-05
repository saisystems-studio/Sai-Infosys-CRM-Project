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
    building: (
      <>
        <rect x="4" y="8" width="16" height="14" rx="2" />
        <path d="M8 22V14h8v8" />
        <path d="M12 14v8" />
      </>
    ),
    users: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5.3 18.5a8 8 0 0 1 13.4 0" />
      </>
    ),
    chart: (
      <>
        <path d="M21 12v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3" />
        <path d="m15 6 6-3-3 6" />
        <circle cx="15" cy="15" r="1.5" />
      </>
    ),
    check: (
      <>
        <path d="m9 12 2 2 4-4" />
        <circle cx="12" cy="12" r="10" />
      </>
    ),
    star: (
      <>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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
      const apiUrl = import.meta.env.VITE_API_URL || "/crm/api";

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
      {/* Left Panel - Brand Side */}
      <section
        className="brand-panel"
        aria-label="Sai Infosys CRM introduction"
      >
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="orb orb-three" />

        {/* Animated background particles */}
        <div className="particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>

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

        {/* Feature Grid - Replacing Dashboard Preview */}
        <div className="feature-grid">
          <div className="feature-card">
            <div
              className="feature-icon"
              style={{ background: "rgba(108, 92, 231, 0.15)" }}
            >
              <Icon name="users" size={18} />
            </div>
            <div className="feature-content">
              <h4>Team Collaboration</h4>
              <p>Real-time sync across your entire sales team</p>
            </div>
          </div>
          <div className="feature-card">
            <div
              className="feature-icon"
              style={{ background: "rgba(80, 210, 162, 0.15)" }}
            >
              <Icon name="chart" size={18} />
            </div>
            <div className="feature-content">
              <h4>Analytics Dashboard</h4>
              <p>Track performance with intelligent insights</p>
            </div>
          </div>
          <div className="feature-card">
            <div
              className="feature-icon"
              style={{ background: "rgba(255, 180, 50, 0.15)" }}
            >
              <Icon name="star" size={18} />
            </div>
            <div className="feature-content">
              <h4>Smart Automation</h4>
              <p>AI-powered workflows to boost productivity</p>
            </div>
          </div>
          <div className="feature-card">
            <div
              className="feature-icon"
              style={{ background: "rgba(255, 107, 107, 0.15)" }}
            >
              <Icon name="shield" size={18} />
            </div>
            <div className="feature-content">
              <h4>Enterprise Security</h4>
              <p>Bank-grade encryption & compliance ready</p>
            </div>
          </div>
        </div>

        <div className="trust-line">
          <Icon name="shield" size={16} />
          <span>Enterprise-grade security</span>
          <i />
          99.9% uptime
        </div>
      </section>

      {/* Right Panel - Login Form */}
      <section className="form-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="logo-mark">SI</div>
            <strong>Sai Infosys</strong>
          </div>

          <div className="welcome">
            <span className="welcome-kicker">Welcome back</span>
            <h2>Sign in to your account</h2>
            <p>Enter your credentials to access your CRM workspace.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="login-error" role="alert">
                <Icon name="shield" size={14} />
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

            <div className="form-options">
              <label className="remember">
                <input type="checkbox" />
                <span className="checkmark" />
                Keep me signed in
              </label>
            </div>

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

          <div className="social-buttons">
            <button className="btn-social google">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
            <button className="btn-social microsoft">
              <svg width="20" height="20" viewBox="0 0 23 23">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="12" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="12" width="9" height="9" fill="#00A4EF" />
                <rect x="12" y="12" width="9" height="9" fill="#FFB900" />
              </svg>
              Microsoft
            </button>
            <button className="btn-social sso">
              <span className="sso-mark">S</span>
              Company SSO
            </button>
          </div>

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
