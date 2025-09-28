# Deployment Guide: Getting a Static Website Live on the Internet

This document outlines the complete process used to deploy Mason Borchard's personal website from development to production on the internet.

## Overview

This guide covers deploying a static HTML website using a VPS (Virtual Private Server), custom domain, and nginx web server. The process involves server setup, domain configuration, DNS management, web server configuration, and security considerations.

## Step 1: VPS Setup

### Choosing a VPS Provider
- **Provider**: Vultr (vultr.com)
- **Plan**: Basic/entry-level VPS instance
- **Specifications**:
  - 1 vCPU
  - 1GB RAM
  - 25GB SSD storage
  - 1TB bandwidth
- **Operating System**: Debian 12 (recommended for stability)
- **Cost**: ~$5-6/month
- Add ssh keys to vultr and attach to instance before deploying it so you can connect easily later

## Step 2: Domain Registration and DNS Configuration

### Domain Registration
- **Registrar**: Any reputable domain registrar (epik.com)
- **Domain**: masonborchard.com
- **Cost**: ~$10-15/year for .com domain

### DNS Record Configuration
Configure the following DNS records in your domain registrar's control panel:

```
Type    Name    Value                   TTL
A       @       YOUR_VPS_IPV4_ADDRESS   30
A       www     YOUR_VPS_IPV4_ADDRESS   30
AAAA    @       YOUR_VPS_IPV6_ADDRESS   30
AAAA    www     YOUR_VPS_IPV6_ADDRESS   30
```

**Notes:**
- `@` represents the root domain (masonborchard.com) -> the @ you can leave out as blank works with Epik
- `www` creates the www subdomain (www.masonborchard.com)
- A records point to IPv4 addresses
- AAAA records point to IPv6 addresses
- TTL of 30 seconds allows for quick DNS updates during setup

## Step 3: Web Server Installation and Configuration

### Install nginx
```bash
# Install nginx web server
sudo apt install nginx -y

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify nginx is running
sudo systemctl status nginx
```

### Create Website Directory Structure
```bash
# Create directory for the website
sudo mkdir -p /var/www/masonborchard.com

# Set appropriate permissions
sudo chmod -R 755 /var/www/masonborchard.com
```

### Upload Website Files
```bash
# Copy your index.html to the web directory via rsync or w/e
# Or create a quick "hello world" index.html
vim /var/www/masonborchard.com/index.html
```

### Configure nginx Virtual Host

Create nginx configuration file:
```bash
sudo vim /etc/nginx/sites-available/masonborchard.com
```

Add the following configuration:
```nginx
server {
    listen 80;
    listen [::]:80;

    server_name masonborchard.com www.masonborchard.com;

    root /var/www/masonborchard.com;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/masonborchard.com /etc/nginx/sites-enabled/

# Remove default nginx site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 4: Firewall Configuration

### Configure UFW (Uncomplicated Firewall)

```bash
# Install UFW if not already installed
sudo apt install ufw -y

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow ssh

# Allow HTTP and HTTPS traffic
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check firewall status
sudo ufw status verbose
```

## Step 5: SSL Certificate Setup (Optional but Recommended)

### Install Certbot for Let's Encrypt SSL

```bash
# Install certbot with nginx plugin via apt
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate (make sure your domain is already pointing to your server)
sudo certbot --nginx -d masonborchard.com -d www.masonborchard.com

# Test automatic renewal
sudo certbot renew --dry-run
```

**Important Prerequisites for Certbot:**
1. **DNS must be working**: Your domain must already be pointing to your server and resolving correctly
2. **HTTP must be accessible**: Your nginx site must be working on port 80 before running certbot
3. **Firewall must allow HTTP/HTTPS**: Ensure ports 80 and 443 are open

**How Certbot Works:**
1. Certbot creates temporary files in your web directory to verify domain ownership
2. Let's Encrypt servers access these files via HTTP to confirm you control the domain
3. Once verified, certbot downloads the SSL certificates
4. The `--nginx` flag automatically updates your nginx configuration to use HTTPS
5. Certbot sets up automatic renewal via systemd timer

**If Certbot Fails:**
- Verify domain resolution: `dig masonborchard.com` should return your server IP
- Test HTTP access: `curl -I http://masonborchard.com` should return a 200 response
- Check nginx logs: `sudo tail /var/log/nginx/error.log`
- Ensure no other services are using port 80

This will automatically:
- Obtain SSL certificates from Let's Encrypt
- Update nginx configuration to use HTTPS and redirect HTTP to HTTPS
- Set up automatic certificate renewal (certificates expire every 90 days)

## Step 6: Verification and Testing

### Test Website Accessibility
1. **DNS Propagation**: Use tools like `dig` or online DNS checkers

   ```bash
   dig masonborchard.com
   dig www.masonborchard.com
   ```

2. **HTTP Response**: Test with curl

   ```bash
   curl -I http://masonborchard.com
   curl -I https://masonborchard.com  # if SSL configured
   ```

3. **Browser Testing**: Visit the domain in multiple browsers

### Performance and Security Testing
- **GTmetrix** or **PageSpeed Insights**: Test loading performance
- **SSL Labs**: Test SSL configuration (if HTTPS enabled)
- **Security Headers**: Check security header implementation

## Step 7: Ongoing Maintenance

### Regular Tasks
- **System Updates**: `sudo apt update && sudo apt upgrade`
- **Log Monitoring**: Check nginx logs in `/var/log/nginx/`
- **SSL Renewal**: Automated via certbot, but monitor for issues
- **Backup**: Regular backups of website files and server configuration

### Monitoring

```bash
# Check nginx status
sudo systemctl status nginx

# View nginx access logs
sudo tail -f /var/log/nginx/access.log

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check server resources
htop
df -h
```

## Cost Breakdown

- **VPS**: ~$5-6/month
- **Domain**: ~$10-15/year
- **SSL Certificate**: Free (Let's Encrypt)
- **Total Annual Cost**: ~$75-90/year

## Troubleshooting Common Issues

### DNS Not Resolving
- Check DNS record configuration in registrar panel
- Wait for DNS propagation (up to 48 hours) but it usually only takes a few minutes
- Use DNS checker tools online

### Website Not Loading
- Verify nginx is running: `sudo systemctl status nginx`
- Check nginx configuration: `sudo nginx -t`
- Review nginx error logs: `sudo tail /var/log/nginx/error.log`

### SSL Certificate Issues
- Ensure domain points to server before running certbot
- Check firewall allows HTTP/HTTPS traffic
- Verify nginx configuration is correct

This deployment process provides a robust, scalable foundation for hosting static websites with professional-grade infrastructure and security.
