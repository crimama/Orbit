import { NextPageContext } from "next";

interface ErrorProps {
  statusCode?: number;
}

function ErrorPage({ statusCode }: ErrorProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: "#888" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 500 }}>
        {statusCode ? `${statusCode} — Server Error` : "An error occurred"}
      </h1>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
