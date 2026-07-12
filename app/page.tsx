import { Blockers } from "@/components/cards/Blockers";
import { CalendarCard } from "@/components/cards/CalendarCard";
import { ClientWork } from "@/components/cards/ClientWork";
import { DayTasks } from "@/components/cards/DayTasks";
import { DayTimeline } from "@/components/cards/DayTimeline";
import { FinancePulse } from "@/components/cards/FinancePulse";
import { GoalsCard } from "@/components/cards/Goals";
import { Habits } from "@/components/cards/Habits";
import { Nutrition } from "@/components/cards/Nutrition";
import { Operator } from "@/components/cards/Operator";
import { Session } from "@/components/cards/Session";
import { Timers } from "@/components/cards/Timers";

export default function Home() {
  return (
    <div className="home-grid">
      <div className="col">
        <Operator />
        <FinancePulse />
        <Blockers />
        <Timers />
      </div>
      <div className="col">
        <Session />
        <DayTimeline />
        <DayTasks />
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
