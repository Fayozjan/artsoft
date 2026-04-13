import { useTelegram } from "../hooks/useTelegram";
import FacePassesPageWeb from "./FacePassesPageWeb";
import FacePassesPageTelegram from "./FacePassesPageTelegram";

const FacePassesPage = () => {
  const { isTelegram } = useTelegram();

  return isTelegram ? <FacePassesPageTelegram /> : <FacePassesPageWeb />;
};

export default FacePassesPage;
