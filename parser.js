const { Writable } = require('stream');
const { Readable } = require('stream');

class FileReader extends Readable {
  constructor(source) {
    super(source);
    this.source = source;
    this.offset = 0;
    this.length = source.length;
    this.on('end', this._destroy.bind(this));
  }
  _read(size) {
    if (this.offset < this.length) {
      this.push(this.source.slice(this.offset, this.offset + size));
      this.offset += size;
    }

    if (this.offset >= this.length) {
      this.push(null);
    }
  }
  _destroy() {
    this.source = null;
    this.offset = null;
    this.length = null;
  }
}
class Parser extends Writable {
  constructor(options) {
    super(options);
    this.headers = options.headers;
    this.RNRN = Buffer.from('\r\n\r\n');
    this.buffer = Buffer.alloc(0);
    this.boundary = null;
    this.cnt = 0;
  }

  parseData() {
    const boundaryPos = this.buffer.indexOf(this.boundary);
    const breakPos = this.buffer.indexOf(this.RNRN);
    if (boundaryPos !== -1 && breakPos !== -1) {
      const dataHeaders = this.buffer.slice(boundaryPos + this.boundary.length + 2, breakPos);
      const parsedHeaders = Parser.parseDataHeaders(dataHeaders);
      // buffer without data headers
      this.buffer = this.buffer.slice(breakPos + this.RNRN.length);
      const nextBoundaryPos = this.buffer.indexOf(this.boundary);
      const contentDispos = Parser.objectifyContentDispos(parsedHeaders);
      const content = this.buffer.slice(0, nextBoundaryPos - 2);
      if (contentDispos.hasOwnProperty('filename')) {
        this.emitFile(content, contentDispos);
      } else {
        this.emitData(content, contentDispos);
      }

      this.buffer = this.buffer.slice(nextBoundaryPos);
      this.parseData();
    }
  }

  static objectifyContentDispos(parsedHeaders) {
    const objectified = parsedHeaders['content-disposition'].split(';').reduce((acc, item, i) => {
      if (i === 0) return acc;
      const [prop, val] = item.split('=');
      acc[prop.trim()] = val.trim().replace(/"/g, '');
      return acc;
    }, {});
    if (objectified.hasOwnProperty('filename')) {
      objectified.contentType = parsedHeaders['content-type'];
    }
    console.log(objectified);
    return objectified;
  }

  emitFile(file, props) {
    const { name, filename, contentType } = props;
    const fileStream = new FileReader(file);
    this.emit('file', name, fileStream, filename, contentType);
  }

  emitData(data, props) {
    const { name } = props;
    this.emit('field', name, data);
  }

  _write(chunk, encoding, callback) {
    if (this.isMultiPart(this.headers)) {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parseData();
    }
    console.log(`_write has been called ${++this.cnt} times`);
    // console.log(this.headers);
    // console.log('*********************************');
    // console.log(chunk.toString());
    callback();
  }

  static parseDataHeaders(dataHeaders) {
    const headersStr = dataHeaders.toString();
    if (headersStr.includes('\r\n')) {
      const headers = headersStr.split('\r\n').reduce((acc, string) => {
        const [left, right] = string.split(':');
        acc[left.toLowerCase()] = right.trim();
        return acc;
      }, {});
      return headers;
    }
    const [left, right] = headersStr.split(':');
    const headers = { [left.toLowerCase()]: right.trim() };
    return headers;
  }

  isMultiPart(headers) {
    if (headers.hasOwnProperty('content-type')) {
      const [type, boundaryPart] = headers['content-type'].split(' ');
      if (type === 'multipart/form-data;') {
        const boundary = boundaryPart.replace(/boundary=/i, '');
        this.boundary = Buffer.from(`--${boundary}`);
        return true;
      }
      return false;
    }
    this.emit('error', 'Content type must be defined');
    return false;
  }
}

module.exports = Parser;
