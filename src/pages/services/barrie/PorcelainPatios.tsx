import BarrieServicePage from '../../../components/BarrieServicePage';
import { getBarrieService } from '../../../data/barrieServices';

// Content lives in src/data/barrieServices.ts ('porcelain-patios-barrie').
export default function PorcelainPatios() {
  return <BarrieServicePage def={getBarrieService('porcelain-patios-barrie')} />;
}
