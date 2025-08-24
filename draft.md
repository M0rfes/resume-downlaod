# Purpose
This project is to show cash how we can implement a Resume download feature using react.

# Steps

To generate random_file.bin run the bellow command

```bash
cd data && dd if=/dev/urandom of=random_file.bin bs=1024 count=1000
```

run `npm i` in all 3 folders

```bash
cd fe && npm i
cd express-be && npm i
cd nest-be && npm i
```

now you can run the FE and anyone of the backend

run fe with express
```bash 
cd fe && npm run dev
cd express-be && npm start
```

run fe with nest

```bash
cd fe && npm run dev
cd nest-be && npm run start:dev
```

# Expiations

## FE (react)

I am using `idb` as an abstraction over `index-db`. I used react but same can be done with any front end framework

### A 10K feet view

we are downloading a file by chunks an using `idb` to keep track of how much we have downloaded do far
our backend takes a start and end value and gives us only that slice of data.

```ts
  const start = useCallback(async () => {
    setError(null);
    setIsDownloading(true);
    const db = await getDb();
    const { offset, totalSize } = await getMeta(db);
    await downloadChunk(offset, db, totalSize);
  }, [downloadChunk]);
```

The above code start the download by initializing the index DB and calling `downloadChunk`

```ts
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
  ```

in `downloadChunk` we do some error handling update the total and offset value. we store the bytes that we got in the indexDB as an arrayBuffer and recursively call `downloadChunk` till we have all the bytes.
once we have all the bytes we will make blob and and trigger a download. and finally clean the index db.


## Pause
```ts
  const pause = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsDownloading(false);
    }
  }, []);
```

To pause we use the `new AbortController()` and call abort this aborts the current fetch request


# backend

```js
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "../","data", req.params.filename);
  console.log(filePath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // e.g. "bytes=1000-"
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    console.log("sending chunk", start, end);
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "application/octet-stream",
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    console.log("sending full file");
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});
```

this is the handler for serving out files we FE doesn't sends range we send then the entire file. else we send then only the slice they asked for. The header `"Content-Type": "application/octet-stream"` is used in HTTP responses to indicate that the content being sent is arbitrary binary data—meaning the server does not know, or does not wish to specify, a more precise type like image/png or application/pdf.


# Background
I came implemented a variation on this approach to offer resumeable downland of a CSV with over 80k rows the just in place of bytes I was sending row numbers. This way the client can stop the download mid way but still have usable data and then can resume getting more rows.
Just make sure the Content-Type header is text/csv