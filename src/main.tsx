import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Render app - ClerkProvider will show error if key is missing
createRoot(document.getElementById("root")!).render(
  PUBLISHABLE_KEY ? (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  ) : (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Configuration Required</h1>
      <p>Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.</p>
      <p>Please add it to your .env file.</p>
    </div>
  )
);
