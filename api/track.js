// Vercel Serverless Function: api/track.js
// Handles client-side tracking requests, updates Supabase sessions and events, and sends email notifications.

const { createClient } = require('@supabase/supabase-js');
const UAParser = require('ua-parser-js');
const nodemailer = require('nodemailer');

// Initialize Supabase Client with service role key to bypass RLS for tracking writes
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

// Email sender function
async function sendEmailNotification(subject, htmlContent) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS; // Gmail App Password
  const to = process.env.NOTIFICATION_EMAIL || user;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');

  if (!user || !pass) {
    console.log('SMTP credentials not configured. Skipping email notification.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  try {
    await transporter.sendMail({
      from: `"Portfolio Analytics" <${user}>`,
      to,
      subject,
      html: htmlContent
    });
    console.log('Email notification sent.');
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabase) {
    res.status(500).json({ error: 'Supabase credentials are not configured.' });
    return;
  }

  try {
    const payload = req.body || {};
    const {
      session_id,
      visitor_id,
      screen_resolution,
      language,
      timezone,
      referrer,
      current_page,
      landing_page,
      event_type,
      event_data = {}
    } = payload;

    if (!session_id) {
      res.status(400).json({ error: 'Missing session_id' });
      return;
    }

    // 1. Get client IP address
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress || 
               'Unknown';

    // 2. Resolve Geolocation (use Vercel headers in production, fallback in dev)
    let country = req.headers['x-vercel-ip-country'] || '';
    let city = req.headers['x-vercel-ip-city'] || '';
    let region = req.headers['x-vercel-ip-country-region'] || '';
    let latitude = req.headers['x-vercel-ip-latitude'] || '';
    let longitude = req.headers['x-vercel-ip-longitude'] || '';

    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      country = 'Local Dev';
      city = 'Local City';
      region = 'Local Region';
      latitude = 0;
      longitude = 0;
    } else if (!country && ip && ip !== 'Unknown') {
      try {
        const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
        const geoData = await geoResponse.json();
        if (geoData && !geoData.error) {
          country = geoData.country_name || geoData.country || '';
          city = geoData.city || '';
          region = geoData.region || '';
          latitude = geoData.latitude || '';
          longitude = geoData.longitude || '';
        }
      } catch (err) {
        console.error('Failed to fetch fallback geolocation:', err);
      }
    }

    country = country || 'Unknown';
    city = city || 'Unknown';
    region = region || 'Unknown';

    // 3. Parse User-Agent
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const browserInfo = parser.getBrowser();
    const osInfo = parser.getOS();
    const deviceInfo = parser.getDevice();

    const browser = browserInfo.name || 'Unknown';
    const browser_version = browserInfo.version || 'Unknown';
    const operating_system = osInfo.name || 'Unknown';
    
    // Guess device type if empty
    let device_type = deviceInfo.type || 'Desktop';
    if (device_type === 'Desktop' && (operating_system === 'Android' || operating_system === 'iOS')) {
      device_type = 'Mobile';
    }

    // 4. Check if session already exists
    const { data: existingVisitor, error: findError } = await supabase
      .from('visitors')
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle();

    if (findError) {
      console.error('Error fetching visitor session:', findError);
    }

    const now = new Date().toISOString();
    let updatedFields = {};
    let isNewSession = false;

    if (!existingVisitor) {
      // Create new session record
      isNewSession = true;
      const initialPages = event_type === 'page_view' ? [current_page] : [];
      const resumeDownloadedCount = event_type === 'resume_download' ? 1 : 0;
      const contactFormSubmitted = event_type === 'contact_submit';
      const initialProjectClicks = event_type === 'project_click' && event_data.project_name
        ? { [event_data.project_name]: 1 }
        : {};

      updatedFields = {
        session_id,
        ip_address: ip,
        country,
        city,
        region,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        browser,
        browser_version,
        operating_system,
        device_type,
        screen_resolution,
        language,
        timezone,
        referrer,
        current_page,
        landing_page,
        visit_time: now,
        last_activity: now,
        session_duration: 0,
        pages_visited: initialPages,
        resume_downloaded: resumeDownloadedCount,
        contact_form_submitted: contactFormSubmitted,
        project_clicked: initialProjectClicks,
        created_at: now
      };

      const { error: insertError } = await supabase
        .from('visitors')
        .insert([updatedFields]);

      if (insertError) {
        console.error('Error inserting visitor session:', insertError);
        res.status(500).json({ error: 'Failed to write session' });
        return;
      }
    } else {
      // Update existing session record
      const visitTime = new Date(existingVisitor.visit_time);
      const lastActivityTime = new Date(now);
      const sessionDuration = Math.round((lastActivityTime - visitTime) / 1000); // duration in seconds

      let pagesVisited = Array.isArray(existingVisitor.pages_visited) 
        ? existingVisitor.pages_visited 
        : [];
      if (event_type === 'page_view' && current_page && !pagesVisited.includes(current_page)) {
        pagesVisited = [...pagesVisited, current_page];
      }

      let resumeDownloaded = parseInt(existingVisitor.resume_downloaded || 0);
      if (event_type === 'resume_download') {
        resumeDownloaded += 1;
      }

      let contactFormSubmitted = existingVisitor.contact_form_submitted || false;
      if (event_type === 'contact_submit') {
        contactFormSubmitted = true;
      }

      let projectClicked = typeof existingVisitor.project_clicked === 'object' && existingVisitor.project_clicked !== null
        ? existingVisitor.project_clicked
        : {};
      if (event_type === 'project_click' && event_data.project_name) {
        const pName = event_data.project_name;
        projectClicked[pName] = (projectClicked[pName] || 0) + 1;
      }

      updatedFields = {
        last_activity: now,
        session_duration: sessionDuration,
        pages_visited: pagesVisited,
        resume_downloaded: resumeDownloaded,
        contact_form_submitted: contactFormSubmitted,
        project_clicked: projectClicked,
        current_page: current_page || existingVisitor.current_page
      };

      const { error: updateError } = await supabase
        .from('visitors')
        .update(updatedFields)
        .eq('session_id', session_id);

      if (updateError) {
        console.error('Error updating visitor session:', updateError);
        res.status(500).json({ error: 'Failed to update session' });
        return;
      }
    }

    // 5. Insert Timeline Event (skip heartbeat to avoid filling db with redundant intervals)
    if (event_type && event_type !== 'heartbeat') {
      const { error: eventError } = await supabase
        .from('visitor_events')
        .insert([{
          session_id,
          event_type,
          event_data,
          created_at: now
        }]);

      if (eventError) {
        console.error('Error writing visitor event:', eventError);
      }
    }

    // 6. Handle Email Notifications
    if (isNewSession) {
      // Send notification for new visitor
      const subject = `🔔 New Portfolio Visitor from ${city}, ${country}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #c8dfe8; padding: 20px; border-radius: 8px; background-color: #f0f7f9; color: #0f2432;">
          <h2 style="color: #0e7490; border-bottom: 2px solid #0e7490; padding-bottom: 8px; margin-top: 0;">New Visitor Alert</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 35%;">Country:</td>
              <td style="padding: 6px 0; color: #3d6478;">${country}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">City:</td>
              <td style="padding: 6px 0; color: #3d6478;">${city}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Device:</td>
              <td style="padding: 6px 0; color: #3d6478;">${device_type}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">OS:</td>
              <td style="padding: 6px 0; color: #3d6478;">${operating_system}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Browser:</td>
              <td style="padding: 6px 0; color: #3d6478;">${browser} (${browser_version})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Referrer:</td>
              <td style="padding: 6px 0; color: #3d6478; word-break: break-all;">${referrer || 'Direct'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Landing Page:</td>
              <td style="padding: 6px 0; color: #3d6478; word-break: break-all;">${landing_page || current_page}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Time:</td>
              <td style="padding: 6px 0; color: #3d6478;">${new Date(now).toLocaleString()}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #6a94a8; border-top: 1px solid #c8dfe8; padding-top: 10px;">
            This session is logged in your Supabase database. Log in to your private admin dashboard to see their path.
          </p>
        </div>
      `;
      // Send alert asynchronously (don't block the HTTP response)
      sendEmailNotification(subject, html);
    } else if (event_type === 'resume_download') {
      // Send notification for resume download
      const subject = `📄 Resume Downloaded - Visitor from ${city}, ${country}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #c8dfe8; padding: 20px; border-radius: 8px; background-color: #f0f7f9; color: #0f2432;">
          <h2 style="color: #0e7490; border-bottom: 2px solid #0e7490; padding-bottom: 8px; margin-top: 0;">Resume Downloaded</h2>
          <p style="font-size: 16px; margin: 15px 0;">A visitor from <strong>${city}, ${country}</strong> has downloaded your resume placeholder.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 35%;">Visitor Device:</td>
              <td style="padding: 6px 0; color: #3d6478;">${device_type} (${operating_system})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Browser:</td>
              <td style="padding: 6px 0; color: #3d6478;">${browser}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Download Time:</td>
              <td style="padding: 6px 0; color: #3d6478;">${new Date(now).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Session ID:</td>
              <td style="padding: 6px 0; color: #6a94a8; font-family: monospace; font-size: 12px;">${session_id}</td>
            </tr>
          </table>
        </div>
      `;
      sendEmailNotification(subject, html);
    } else if (event_type === 'contact_submit') {
      // Send notification for contact submission
      const subject = `📧 New Contact Form Submission - ${city}, ${country}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #c8dfe8; padding: 20px; border-radius: 8px; background-color: #f0f7f9; color: #0f2432;">
          <h2 style="color: #0e7490; border-bottom: 2px solid #0e7490; padding-bottom: 8px; margin-top: 0;">Contact Form Submitted</h2>
          <p style="font-size: 16px; margin: 15px 0;">A visitor from <strong>${city}, ${country}</strong> has successfully submitted a message via Web3Forms.</p>
          <p style="color: #eab308; font-weight: bold; font-size: 14px;">⚠️ Message contents are NOT logged in analytics database for compliance & security. Check Web3Forms/email for the content.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 35%;">Visitor Device:</td>
              <td style="padding: 6px 0; color: #3d6478;">${device_type} (${operating_system})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Submission Time:</td>
              <td style="padding: 6px 0; color: #3d6478;">${new Date(now).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Session ID:</td>
              <td style="padding: 6px 0; color: #6a94a8; font-family: monospace; font-size: 12px;">${session_id}</td>
            </tr>
          </table>
        </div>
      `;
      sendEmailNotification(subject, html);
    }

    res.status(200).json({ success: true, is_new: isNewSession });
  } catch (error) {
    console.error('Tracking endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
