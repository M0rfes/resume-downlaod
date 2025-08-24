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