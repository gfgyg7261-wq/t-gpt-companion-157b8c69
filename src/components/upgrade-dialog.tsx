import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, Rocket, ExternalLink } from "lucide-react";

const DISCORD_URL = "https://discord.gg/7Dr7PgpqJ";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    icon: Sparkles,
    features: ["Unlimited normal chats", "5 Website Builder credits / day", "Standard models", "Community support"],
    cta: "Current plan",
    disabled: true,
  },
  {
    name: "Pro",
    price: "$19",
    icon: Crown,
    highlight: true,
    features: ["Everything in Free", "Tiger-5 model access", "Tiger Pro reasoning", "Unlimited builder credits", "Custom domains", "Priority support"],
    cta: "Get Pro on Discord",
  },
  {
    name: "Team",
    price: "$49",
    icon: Rocket,
    features: ["Everything in Pro", "Workspace collaboration", "Tiger Pro Max", "API access", "SSO & audit logs", "Dedicated support"],
    cta: "Get Team on Discord",
  },
];

export function UpgradeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const goDiscord = () => window.open(DISCORD_URL, "_blank", "noopener,noreferrer");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Upgrade <span className="text-gradient">T-GPT</span>
          </DialogTitle>
          <DialogDescription>
            To purchase Pro or Team, join our Discord — our team will set you up instantly.
          </DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-3 gap-4 mt-2">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-5 flex flex-col ${
                tier.highlight ? "border-primary bg-gradient-to-b from-primary/10 to-transparent shadow-glow" : "border-border bg-card/50"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider bg-gradient-brand text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                  Popular
                </span>
              )}
              <div className="flex items-center gap-2">
                <tier.icon className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg">{tier.name}</h3>
              </div>
              <p className="mt-2 text-3xl font-bold">
                {tier.price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                disabled={tier.disabled}
                onClick={goDiscord}
                className={`mt-5 w-full ${tier.highlight ? "bg-gradient-brand text-primary-foreground border-0 shadow-glow" : ""}`}
                variant={tier.highlight ? "default" : "outline"}
              >
                {tier.cta}
                {!tier.disabled && <ExternalLink className="h-3.5 w-3.5 ml-1" />}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Powered by <a href="https://www.tigerhost.space/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">TigerHost</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
