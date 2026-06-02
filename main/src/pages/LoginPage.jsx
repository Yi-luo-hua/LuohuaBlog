import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/** 登录已并入右下角 AI 小精灵；此路由仅用于跳转并自动打开面板 */
const LoginPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") === "register" ? "register" : "login";

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("blog-ai-open", { detail: { view: "auth", mode } })
    );
    navigate("/", { replace: true });
  }, [mode, navigate]);

  return null;
};

export default LoginPage;
