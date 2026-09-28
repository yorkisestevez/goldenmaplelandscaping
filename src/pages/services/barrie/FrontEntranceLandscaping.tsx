import BarrieServicePage from '../../../components/BarrieServicePage';
import { getBarrieService } from '../../../data/barrieServices';

// Content lives in src/data/barrieServices.ts ('front-entrance-landscaping-barrie').
export default function FrontEntranceLandscaping() {
  return <BarrieServicePage def={getBarrieService('front-entrance-landscaping-barrie')} />;
}
