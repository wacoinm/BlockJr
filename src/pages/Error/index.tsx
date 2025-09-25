// src/pages/Error/index.tsx
import {
  useNavigate,
  useRouteError,
  isRouteErrorResponse
} from "react-router";
import { errors } from "./errors";

type ErrorPageProps = {
  code?: number | string;
  title?: string;
  description?: string;
};

const errorMap = new Map<string, string>(
  errors.map((e) => [String(e.code), e.message])
);

function getTitleByCode(code?: number | string) {
  const c = String(code ?? "");
  switch (c) {
    case "404":
      return "صفحه گمشده 🧭";
    case "500":
      return "یه مشکلی پیش اومد ⚙️";
    case "403":
      return "دسترسی ندارید 🚪";
    case "400":
      return "درخواست نامعتبر ✉️";
    default:
      return "اوه — مشکلی پیش اومد ✨";
  }
}

export default function ErrorPage(props: ErrorPageProps) {
  const routeError = useRouteError();
  const navigate = useNavigate();

  // استخراج کد و پیغام از خطای روت
  let routeCode: number | string | undefined = undefined;
  let routeMessage: string | undefined = undefined;

  if (isRouteErrorResponse(routeError)) {
    routeCode = routeError.status;
    routeMessage =
      typeof routeError.data === "string" ? routeError.data : undefined;
  } else if (routeError && typeof routeError === "object") {
    // @ts-ignore
    if (routeError.status) routeCode = routeError.status;
    // @ts-ignore
    if (routeError.message) routeMessage = String(routeError.message);
  } else if (routeError) {
    routeMessage = String(routeError);
  }

  const code = props.code ?? routeCode;
  const title = props.title ?? getTitleByCode(code);

  const msgFromJson = code != null ? errorMap.get(String(code)) : undefined;
  const description =
    props.description ??
    msgFromJson ??
    routeMessage ??
    errorMap.get("default") ??
    "";

  return (
    <div
      dir="rtl"
      className="error-page-root min-h-screen flex items-center justify-center px-4"
    >
      <main
        role="alert"
        aria-live="polite"
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden
                   grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-10 text-right"
      >
        {/* بخش ماسکات */}
        <section className="flex items-center justify-center relative p-2">
          <div className="mascot-wrap">
            <svg
              viewBox="0 0 220 220"
              width="100%"
              height="100%"
              className="mascot"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0" stopColor="#FFD571" />
                  <stop offset="1" stopColor="#FFB199" />
                </linearGradient>
                <linearGradient id="g2" x1="0" x2="1">
                  <stop offset="0" stopColor="#9EE2FF" />
                  <stop offset="1" stopColor="#86E1B8" />
                </linearGradient>
              </defs>

              <g transform="translate(110 40)" className="balloon">
                <ellipse cx="0" cy="0" rx="36" ry="46" fill="url(#g1)" />
                <path
                  d="M -4 42 q 4 6 8 0"
                  fill="#fff"
                  opacity="0.9"
                />
                <line
                  x1="-4"
                  y1="42"
                  x2="0"
                  y2="80"
                  stroke="#7A4C1B"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>

              <g transform="translate(50 110)" className="creature">
                <ellipse cx="70" cy="20" rx="60" ry="46" fill="url(#g2)" />
                <circle cx="50" cy="10" r="6" fill="#fff" />
                <circle cx="90" cy="10" r="6" fill="#fff" />
                <circle cx="50" cy="10" r="2.5" fill="#111" />
                <circle cx="90" cy="10" r="2.5" fill="#111" />
                <path
                  d="M45 28 q25 20 45 0"
                  stroke="#111"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
                <rect
                  x="26"
                  y="-20"
                  rx="8"
                  ry="8"
                  width="88"
                  height="26"
                  fill="#fff"
                  opacity="0.9"
                />
                <text
                  x="70"
                  y="-2"
                  fontSize="14"
                  fontWeight="700"
                  textAnchor="middle"
                  fill="#333"
                >
                  {String(code ?? "")}
                </text>
              </g>
            </svg>
          </div>
        </section>

        <section className="flex flex-col justify-center p-1">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2 text-gray-200 dark:text-gray-100">
            {title}
          </h1>
          <p className="text-base md:text-lg text-muted mb-6">{description}</p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/")}
              className="btn-primary px-4 py-2 rounded-lg shadow-md"
            >
              بازگشت به خانه
            </button>

            <button
              onClick={() => navigate(-1)}
              className="btn-ghost px-4 py-2 rounded-lg border"
            >
              برگرد به صفحه قبل
            </button>
          </div>

          <small className="mt-4 text-xs text-muted-2">
            اگر مشکل ادامه داشت لطفا دوباره تلاش کن یا پشتیبانی رو خبردار کن.
          </small>
        </section>
      </main>

      <style>{`
        :root {
          --bg: #f7fbff;
          --surface: #ffffff;
          --muted: #64748b;
          --muted-2: #94a3b8;
          --accent: #ff9f7a;
          --shadow: 0 10px 30px rgba(2,6,23,0.12);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #071223;
            --surface: #0b1420;
            --muted: #bfcfe0;
            --muted-2: #9fb0c4;
            --accent: #ffb37a;
            --shadow: 0 10px 30px rgba(2,6,23,0.6);
          }
        }

        .error-page-root { background: linear-gradient(180deg, var(--bg), transparent 60%); }
        .mascot-wrap { width: 100%; max-width: 360px; height: 260px; display:flex; align-items:center; justify-content:center; }
        .mascot { max-width: 100%; height: auto; overflow: visible; }

        .balloon { transform-origin: center; animation: float 5s ease-in-out infinite; }
        @keyframes float {
          0% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
          100% { transform: translateY(0) rotate(-2deg); }
        }

        .creature { transform-origin: center; animation: bob 4s cubic-bezier(.5,.05,.1,1) infinite; }
        @keyframes bob {
          0% { transform: translateY(0) }
          50% { transform: translateY(-8px) scale(1.02) }
          100% { transform: translateY(0) }
        }

        .btn-primary {
          background: linear-gradient(90deg, #78ffd6 0%, #a3ffd8 100%);
          border: none;
          color: #042028;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: var(--shadow); }

        .btn-ghost {
          background: transparent;
          color: var(--muted);
        }

        main[role="alert"] { background: var(--surface); box-shadow: var(--shadow); }
        .text-muted { color: var(--muted); }
        .text-muted-2 { color: var(--muted-2); }

        @media (max-width: 768px) {
          .mascot-wrap { height: 180px; }
          main[role="alert"] { padding: 18px; }
        }
      `}</style>
    </div>
  );
}
