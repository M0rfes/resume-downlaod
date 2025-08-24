import { useState, useRef, useCallback } from "react";
import { openDB, type IDBPDatabase } from "idb";

const CHUNK_SIZE = 1024 * 10; // 10KB per chunk
const DB_NAME = "download-db";
const STORE_NAME = "chunks";

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
    },
  });
}

export function useResumableDownload(url: string, filename: string) {
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const getMeta = async (db: IDBPDatabase) => {
    const offset = (await db.get("meta", "offset")) || 0;
    const totalSize = (await db.get("meta", "totalSize")) || null;
    return { offset, totalSize };
  };

  const setMeta = async (db: IDBPDatabase, offset: number, totalSize?: number) => {
    await db.put("meta", offset, "offset");
    if (totalSize !== undefined) {
      await db.put("meta", totalSize, "totalSize");
    }
  };

  const downloadChunk = useCallback(async (start: number, db: IDBPDatabase, totalSize?: number) => {
    abortControllerRef.current = new AbortController();
    const res = await fetch(url, {
      headers: { Range: `bytes=${start}-${start + CHUNK_SIZE - 1}` },
      signal: abortControllerRef.current.signal,
    });
    if (res.status !== 206 && res.status !== 200) {
      setError(`Unexpected status: ${res.status}`);
      setIsDownloading(false);
      return;
    }

    if (!totalSize) {
      // Parse total file size
      const contentRange = res.headers.get("Content-Range");
      if (contentRange) {
        totalSize = parseInt(contentRange.split("/")[1], 10);
      }
      if (!totalSize) {
        totalSize = parseInt(res.headers.get("Content-Length")!, 10);
      }
      await setMeta(db, start, totalSize);
    }
    const data = await res.arrayBuffer();
    const chunkKey = `chunk-${start}`;
    await db.put(STORE_NAME, data, chunkKey);

    const newOffset = start + data.byteLength;
    await setMeta(db, newOffset, totalSize);

    setProgress((newOffset / totalSize) * 100);

    if (newOffset < totalSize) {
      await downloadChunk(newOffset, db, totalSize);
    } else {
      // Assemble file from chunks
      const keys = [];
      let offset = 0;
      while (offset < totalSize) {
        keys.push(`chunk-${offset}`);
        offset += CHUNK_SIZE;
      }
      const chunkDatas = await Promise.all(keys.map((key) => db.get(STORE_NAME, key)));
      const blob = new Blob(chunkDatas);
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(fileUrl);

      // Cleanup
      await db.clear(STORE_NAME);
      await db.clear("meta");
      setIsDownloading(false);
    }
  }, [url, filename]);

  const start = useCallback(async () => {
    setError(null);
    setIsDownloading(true);
    const db = await getDb();
    const { offset, totalSize } = await getMeta(db);
    await downloadChunk(offset, db, totalSize);
  }, [downloadChunk]);

  const pause = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsDownloading(false);
    }
  }, []);

  const reset = useCallback(async () => {
    setError(null);
    setProgress(0);
    setIsDownloading(false);
    const db = await getDb();
    await db.clear(STORE_NAME);
    await db.clear("meta");
  }, []);

  return {
    progress,
    isDownloading,
    error,
    start,
    pause,
    reset,
  };
}
