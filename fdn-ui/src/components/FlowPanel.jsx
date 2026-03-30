const renderJson = (value) => {
  if (value == null) {
    return "No response yet.";
  }

  return JSON.stringify(value, null, 2);
};

function FlowPanel({
  title,
  flowState,
  lambdaInvocations,
  totalCost,
  latestByLocation,
}) {
  const locationRows = Object.entries(latestByLocation).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <article className="panel">
      <div className="panelHead">
        <h2>{title}</h2>
        {flowState.loading && <span className="statusPill">Fetching...</span>}
      </div>

      <div className="metricsGrid">
        <div className="metricCard">
          <span>Weather score</span>
          <strong className="weatherScore">
            {flowState.weatherScore == null ? "-" : flowState.weatherScore}
          </strong>
        </div>
        <div className="metricCard">
          <span>Latency</span>
          <strong>{flowState.latencyMs == null ? "-" : `${flowState.latencyMs} ms`}</strong>
        </div>
        <div className="metricCard">
          <span>Lambda invocations</span>
          <strong>{lambdaInvocations}</strong>
        </div>
        <div className="metricCard">
          <span>Cost incurred</span>
          <strong>{totalCost}</strong>
        </div>
      </div>

      {flowState.error && <p className="errorText">Error: {flowState.error}</p>}

      <div className="panelSection">
        <p className="responseLabel">Response JSON</p>
        <pre className="responseBlock">{renderJson(flowState.responseJson)}</pre>
      </div>

      <div className="panelSection">
        <p className="responseLabel">Latest score by location</p>
        <div className="locationLog">
          {locationRows.length === 0 ? (
            <p className="emptyText">No locations yet.</p>
          ) : (
            locationRows.map(([name, score]) => (
              <div className="locationRow" key={name}>
                <span>{name}</span>
                <strong>{score}</strong>
              </div>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

export default FlowPanel;
