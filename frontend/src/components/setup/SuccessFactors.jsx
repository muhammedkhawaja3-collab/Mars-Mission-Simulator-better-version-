import './SuccessFactors.css';

/** Expandable explanation of the engine's success heuristic for one vehicle. */
export default function SuccessFactors({ rocket }) {
  if (rocket.failed || !rocket.successFactors) return null;
  return (
    <details className="success-factors">
      <summary>
        Why {rocket.success}% success? · launched on {rocket.launchVehicleName}
      </summary>
      <ul>
        {rocket.successFactors
          .filter((f) => f.probability < 1)
          .map((f) => (
            <li key={f.id}>
              <strong>
                {f.label}: {(f.probability * 100).toFixed(1)}%
              </strong>{' '}
              {f.explanation}
            </li>
          ))}
      </ul>
      <p>Failed uncrewed launches are re-flown: they add expected cost, not mission loss.</p>
    </details>
  );
}
