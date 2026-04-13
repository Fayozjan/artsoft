import { useTelegram } from "../hooks/useTelegram";
import VehiclePassesPageWeb from "./VehiclePassesPageWeb";
import VehiclePassesPageTelegram from "./VehiclePassesPageTelegram";

const VehiclePassesPage = () => {
  const { isTelegram } = useTelegram();

  return isTelegram ? <VehiclePassesPageTelegram /> : <VehiclePassesPageWeb />;
};

export default VehiclePassesPage;
