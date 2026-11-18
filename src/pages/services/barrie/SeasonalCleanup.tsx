import BarrieServicePage from '../../../components/BarrieServicePage';
import { getBarrieService } from '../../../data/barrieServices';

// Content lives in src/data/barrieServices.ts ('seasonal-cleanup-barrie').
export default function SeasonalCleanup() {
  return <BarrieServicePage def={getBarrieService('seasonal-cleanup-barrie')} />;
}
