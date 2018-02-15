const { createServer } = require('http');
const Parser = require('./parser.js'); // ваш код
const fs = require('fs');

createServer((req, res) => {
  if (req.method === 'POST') {
    const parser = new Parser({ headers: req.headers });

    parser.on('file', (fieldname, file, filename, contentType) => {
      // file должен быть Readable stream
      file.on('data', data => {
        console.log(`Got ${data.length} bytes`);
        console.log(`Got ${contentType} as Content Type`);
        // fs.writeFile(filename, data, err => {
        //   if (err) throw err;
        //   console.log('The file has been saved!');
        // });
        const write = fs.createWriteStream(`${__dirname}/${filename}`, { encoding: 'binary' });
        file.pipe(write);
      });
      file.on('end', () => console.log('File finished'));
    });
    parser.on('field', (fieldname, value) => console.log(`${fieldname} ==> ${value}`));

    parser.on('finish', () => {
      console.log('Done parsing form!');
      res.writeHead(200);
      // res.end(JSON.stringify('{ success: true }'));
      res.end(JSON.stringify(req.headers, null, 2));
    });
    req.pipe(parser);
  } else if (req.method === 'GET') {
    res.writeHead(200, { Connection: 'close' });
    res.end('OK');
  }
}).listen(process.env.PORT || 8000, () => console.log('Listening'));
