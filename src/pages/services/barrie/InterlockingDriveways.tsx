import BarrieServicePage from '../../../components/BarrieServicePage';
import { getBarrieService } from '../../../data/barrieServices';

// Content lives in src/data/barrieServices.ts ('interlocking-driveways-barrie').
export default function InterlockingDriveways() {
  return <BarrieServicePage def={getBarrieService('interlocking-driveways-barrie')} />;
}
