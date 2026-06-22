import { handleRsvpRequest } from '../../lib/rsvp-core.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Pin'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    return await handleRsvpRequest({
      method: event.httpMethod,
      body: event.body,
      adminPinHeader: event.headers['x-admin-pin'] || event.headers['X-Admin-Pin']
    });
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        error: err.message === 'DATABASE_URL no configurada'
          ? 'DATABASE_URL no configurada en Netlify'
          : 'Error del servidor'
      })
    };
  }
};
