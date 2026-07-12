import { Blockers } from "@/components/cards/Blockers";
import { CalendarCard } from "@/components/cards/CalendarCard";
import { ClientWork } from "@/components/cards/ClientWork";
import { FinancePulse } from "@/components/cards/FinancePulse";
import { GoalsCard } from "@/components/cards/Goals";
import { Habits } from "@/components/cards/Habits";
import { Nutrition } from "@/components/cards/Nutrition";
import { Operator } from "@/components/cards/Operator";
import { Session } from "@/components/cards/Session";

export default function Home() {
  return (
    <div className="home-grid">
      <div className="col">
        <Operator />
        <FinancePulse />
        <Blockers />
      </div>
      <div className="col">
        <Session />
        <ClientWork />
        <Habits />
        <CalendarCard />
      </div>
      <div className="col">
        <Nutrition />
        <GoalsCard />
      </div>
    </div>
  );
}
