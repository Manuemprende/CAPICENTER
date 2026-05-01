import http from 'http';
['/api/leads', '/api/sales', '/api/dashboard/summary', '/api/performance/ads', '/api/settings/meta', '/api/settings/alerts'].forEach(path => {
  http.get(`http://localhost:3000${path}`, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log(path, res.statusCode, data.substring(0, 50)));
  });
});
