import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "#eee", background: "#111" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Something went wrong.
          </div>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}