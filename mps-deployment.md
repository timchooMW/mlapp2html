# MPS Deployment Guide

How to compile a MATLAB function into a .ctf archive, deploy it to MATLAB Production Server, and configure the server to serve both the API and the front end.

## Compiling the .ctf Archive

### Prerequisites

- MATLAB with MATLAB Compiler and MATLAB Compiler SDK installed
- The standalone .m function(s) with no app.* or UI dependencies
- All helper functions and data files the function depends on

### Using the GUI

1. In MATLAB, run `productionServerCompiler` (or go to Apps tab -> Production Server Compiler)
2. Click **Add Exported Function** and select your .m file
3. Verify dependencies are detected (add any missing files under "Files required for your function to run")
4. Set the **Archive Name** (e.g., `signalApp`) — this becomes part of the API URL
5. Click **Package**
6. The .ctf file is created in the output directory (e.g., `signalApp/for_redistribution_files_only/signalApp.ctf`)

### Using the Command Line

```matlab
mcc -W CTF:signalApp -U generateSignal.m
```

For multiple functions in one archive:

```matlab
mcc -W CTF:signalApp -U generateSignal.m processData.m analyzeResults.m
```

Each function gets its own API endpoint under the same archive name:
- `POST http://localhost:9910/signalApp/generateSignal`
- `POST http://localhost:9910/signalApp/processData`
- `POST http://localhost:9910/signalApp/analyzeResults`

### Including Data Files

If the function loads data files at runtime (e.g., lookup tables, trained models):

```matlab
mcc -W CTF:signalApp -U generateSignal.m -a lookupTable.mat -a trainedModel.mat
```

Within the compiled function, use `ctfroot` to locate bundled files:

```matlab
dataPath = fullfile(ctfroot, 'lookupTable.mat');
load(dataPath);
```

## Deploying to MATLAB Production Server

### Step 1: Copy .ctf to auto_deploy

```bash
cp signalApp.ctf <MPS_INSTALL>/auto_deploy/
```

MPS watches this directory and automatically loads new or updated archives. No server restart needed for new deployments.

### Step 2: Verify Deployment

Hit the discovery endpoint:

```bash
curl http://localhost:9910/api/discovery | jq .
```

You should see your archive and function(s) listed. If not, check the MPS log:

```bash
tail -50 <MPS_INSTALL>/log/main.log
```

### Step 3: Test the API

Use cURL to confirm the function responds correctly (see mps-api.md for the full testing workflow).

```bash
curl -X POST http://localhost:9910/signalApp/generateSignal \
  -H "Content-Type: application/json" \
  -d '{"nargout":1,"rhs":[{"mwdata":[50],"mwsize":[1,1],"mwtype":"double"},{"mwdata":[1],"mwsize":[1,1],"mwtype":"double"},{"mwdata":[0.01],"mwsize":[1,1],"mwtype":"double"},{"mwdata":["Sine"],"mwsize":[1,4],"mwtype":"char"}]}'
```

## Configuring MATLAB Production Server

The main configuration file is at `<MPS_INSTALL>/config/main_config`. Here are the key settings.

### Core Settings

```properties
# HTTP port (default 9910)
--http 9910

# HTTPS (optional)
--https 9920
--ssl-cert /path/to/cert.pem
--ssl-key /path/to/key.pem

# Number of MATLAB worker processes
# More workers = more concurrent requests, but more memory
--num-workers 4

# Request timeout in seconds
--request-timeout 120
```

### Static File Serving (Serve the Front End from MPS)

This is the recommended approach — the front end and API share the same origin, so there are no CORS issues.

```properties
# Enable static file serving
--enable-static-folders true

# Set the root directory for static files
--static-folders-root /opt/mps/static
```

After setting these, organize your front-end files:

```
/opt/mps/static/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── images/
    └── logo.png
```

After restarting MPS, the app is available at:
- Front end: `http://localhost:9910/index.html`
- API: `http://localhost:9910/signalApp/generateSignal`

### CORS Configuration (if NOT using static file serving)

If the front end is served from a different origin:

```properties
--cors-allowed-origins http://localhost:8080,https://myapp.example.com
```

### Restarting MPS

After changing `main_config`:

```bash
# Stop
<MPS_INSTALL>/script/stop.sh

# Start
<MPS_INSTALL>/script/start.sh

# Or on Windows:
<MPS_INSTALL>\script\stop.bat
<MPS_INSTALL>\script\start.bat
```

Note: Deploying new .ctf files to `auto_deploy` does NOT require a restart. Config changes DO require a restart.

## Alternative: External Web Server with Reverse Proxy

If you need more control (authentication, custom routing, CDN), use an external web server.

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name myapp.example.com;

    # Serve static front-end files
    root /var/www/myapp;
    index index.html;

    # Proxy API calls to MATLAB Production Server
    location /signalApp/ {
        proxy_pass http://localhost:9910/signalApp/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;  # Match MPS request-timeout
    }
}
```

The front end uses relative URLs (`/signalApp/generateSignal`) and Nginx forwards them to MPS.

### Apache Configuration

```apache
<VirtualHost *:80>
    ServerName myapp.example.com
    DocumentRoot /var/www/myapp

    ProxyPass /signalApp/ http://localhost:9910/signalApp/
    ProxyPassReverse /signalApp/ http://localhost:9910/signalApp/
    ProxyTimeout 120
</VirtualHost>
```

### Development Server

For local development/testing:

```bash
cd /path/to/your/web/files
python3 -m http.server 8080
```

Access at `http://localhost:8080`. You'll need CORS configured on MPS or a proxy for API calls.

## Updating a Deployed Function

1. Modify and test the .m function in MATLAB
2. Re-compile: `mcc -W CTF:signalApp -U generateSignal.m`
3. Copy the new .ctf to auto_deploy (overwrite the old one)
4. MPS detects the change and reloads automatically
5. Verify with the discovery endpoint and a cURL test

## Versioning Strategy

During active development, include a version in the archive name:

```matlab
mcc -W CTF:signalApp_v2 -U generateSignal.m
```

This creates a separate endpoint (`/signalApp_v2/generateSignal`) so you can test the new version while the old one remains live. Update the front end's URL when ready to cut over.

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---|---|---|
| 404 on API call | .ctf not loaded | Check auto_deploy, check main.log for load errors |
| 500 on API call | MATLAB error | Read main.log for the stack trace, test function in MATLAB desktop |
| Slow first request | Worker startup (cold start) | First request initializes a MATLAB worker; subsequent requests are faster |
| Out of memory | Large data or too many workers | Reduce --num-workers or optimize the function to return less data |
| .ctf won't compile | Missing toolbox or dependency | Check `mcc` output, ensure all required toolboxes are installed |
