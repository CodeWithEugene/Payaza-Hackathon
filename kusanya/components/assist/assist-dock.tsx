import { A11yMenu } from "@/components/assist/a11y-menu";
import { HelpChat } from "@/components/assist/help-chat";

/**
 * Bottom-right dock on every page: accessibility options above, Kusanya Help
 * chat below (the primary action sits nearest the corner). Safe-area aware
 * for phones with a home indicator.
 */
export function AssistDock() {
  return (
    <div
      className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 print:hidden"
      style={{
        right: "max(1rem, env(safe-area-inset-right))",
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <A11yMenu />
      <HelpChat />
    </div>
  );
}
