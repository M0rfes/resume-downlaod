import { useResumableDownload } from "./useResumableDownload";

export function FileDownloader() {
  const { progress, isDownloading, error, start, pause, reset } =
    useResumableDownload(
      "/api/download/random_file.bin",
      "random_file.bin"
    );

  return (
    <div>
      <button onClick={start} disabled={isDownloading}>
        {progress === 100 ? "Redownload" : "Start / Resume"}
      </button>
      <button onClick={pause} disabled={!isDownloading}>
        Pause
      </button>
      <button onClick={reset} disabled={isDownloading}>
        Reset
      </button>
      <div>Progress: {progress.toFixed(2)}%</div>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <div>
        <small>
          You can pause and reload the page, then click "Start / Resume" to
          continue downloading where you left off! When complete, file will be
          downloaded automatically.
        </small>
      </div>
    </div>
  );
}
