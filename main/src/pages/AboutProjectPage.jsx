import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";

const projectShowcaseUrls = {
  quizcard: "/showcase/quizcard.html",
};

const AboutProjectPage = () => {
  const { projectId } = useParams();
  const showcaseUrl = projectShowcaseUrls[projectId];

  useEffect(() => {
    if (showcaseUrl) {
      window.location.replace(showcaseUrl);
    }
  }, [showcaseUrl]);

  if (!showcaseUrl) {
    return <Navigate to="/about" replace />;
  }

  return (
    <section className="about-project-page" aria-label="正在打开项目页面">
      <div className="about-project-shell">
        <a className="about-project-action" href={showcaseUrl}>
          正在打开 AI QuizCard 成品页
        </a>
      </div>
    </section>
  );
};

export default AboutProjectPage;
