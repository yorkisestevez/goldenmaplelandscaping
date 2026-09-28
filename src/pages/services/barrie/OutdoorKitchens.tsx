import BarrieServicePage from '../../../components/BarrieServicePage';
import { getBarrieService } from '../../../data/barrieServices';

// Content lives in src/data/barrieServices.ts ('outdoor-kitchens-barrie').
export default function OutdoorKitchens() {
  return <BarrieServicePage def={getBarrieService('outdoor-kitchens-barrie')} />;
}
