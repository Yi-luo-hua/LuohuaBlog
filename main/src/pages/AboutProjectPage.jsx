import { Link, Navigate, useParams } from "react-router-dom";

const projects = {
  quizcard: {
    title: "AI QuizCard",
    eyebrow: "About / Projects / 01",
    cover: "https://taozhiyy.top/cos/about-page/20260624/project-cover-01-c1278fa4f0.svg",
    summary:
      "把题目粘进来，让 AI 识别、拆解、整理成可以复习的知识卡片。Deep 解析负责把脉络讲清楚，Quick 闪练负责把记忆重新点亮。",
    tags: ["Web", "小程序", "AI", "学习工具"],
    points: [
      "双模式：Deep 解析和 Quick 闪练分开承载不同学习节奏。",
      "双端同构：网页和微信小程序共享同一套产品逻辑。",
      "内容优先：把题目、解析、卡片和复习路径都放在主视线里。",
    ],
    localPreview: "http://127.0.0.1:8765/showcase/quizcard.html",
  },
};

const AboutProjectPage = () => {
  const { projectId } = useParams();
  const project = projects[projectId];

  if (!project) {
    return <Navigate to="/about" replace />;
  }

  return (
    <section className="about-project-page" aria-labelledby="about-project-title">
      <div className="about-project-shell">
        <Link className="about-project-back" to="/about">
          返回关于我
        </Link>

        <div className="about-project-hero">
          <div className="about-project-copy">
            <p className="about-project-eyebrow">{project.eyebrow}</p>
            <h1 id="about-project-title">{project.title}</h1>
            <p className="about-project-summary">{project.summary}</p>
            <div className="about-project-tags">
              {project.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>

          <div className="about-project-cover" aria-hidden="true">
            <img src={project.cover} alt="" />
          </div>
        </div>

        <div className="about-project-detail">
          <div>
            <p className="about-project-section-label">Project Notes</p>
            <h2>目前先把核心信息收在这里。</h2>
          </div>
          <ul>
            {project.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <a className="about-project-action" href={project.localPreview} target="_blank" rel="noopener noreferrer">
            打开本地预览
          </a>
        </div>
      </div>
    </section>
  );
};

export default AboutProjectPage;
