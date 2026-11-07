import BarrieServicePage from '../../../components/BarrieServicePage';
import { getBarrieService } from '../../../data/barrieServices';

export default function LandscapeMaintenance() {
  return <BarrieServicePage def={getBarrieService('landscape-maintenance-barrie')} />;
}
