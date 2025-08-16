import Timer from '../components/Timer';
import PlateCalculator from '../components/PlateCalculator';
import OneRepMaxCalculator from '../components/OneRepMaxCalculator';

export default function Workout() {
  return (
    <div className="container">
      <h1>Workout</h1>
      <div className="tools">
        <Timer />
        <PlateCalculator />
        <OneRepMaxCalculator />
      </div>
    </div> // <-- make sure this closing div exists
  );      // <-- make sure parentheses close
}
