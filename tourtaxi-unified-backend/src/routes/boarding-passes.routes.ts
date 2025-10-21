import express from 'express';
import { z } from 'zod';
import supabase from '../config/supabase';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const boardingPassSchema = z.object({
  ride_event_id: z.string(),
  passenger_name: z.string().min(2),
  booking_id: z.string(),
  vehicle_type: z.enum(['chopper', 'privateJet', 'cruise']),
  destination: z.string(),
  origin: z.string().optional(),
  departure_time: z.string(),
  arrival_time: z.string().optional(),
  operator_name: z.string(),
  operator_logo: z.string().optional(),
  qr_code: z.string(),
  status: z.enum(['upcoming', 'boarding', 'departed', 'completed', 'cancelled']).default('upcoming'),
  seat_number: z.string().optional(),
  gate: z.string().optional(),
  terminal: z.string().optional(),
  fare: z.number().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['upcoming', 'boarding', 'departed', 'completed', 'cancelled']),
});

// GET /api/boarding-passes - Get all boarding passes for authenticated user
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('boarding_passes')
      .select('*')
      .eq('user_id', userId)
      .order('departure_time', { ascending: false });

    if (error) {
      logger.error({ error }, 'Failed to fetch boarding passes');
      return res.status(500).json({ error: 'Failed to fetch boarding passes' });
    }

    res.json({ data });
  } catch (err) {
    logger.error({ err }, 'Error fetching boarding passes');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/boarding-passes/:id - Get specific boarding pass
router.get('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.headers.authorization?.replace('Bearer ', '');
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('boarding_passes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Boarding pass not found' });
      }
      logger.error({ error }, 'Failed to fetch boarding pass');
      return res.status(500).json({ error: 'Failed to fetch boarding pass' });
    }

    res.json({ data });
  } catch (err) {
    logger.error({ err }, 'Error fetching boarding pass');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boarding-passes - Create new boarding pass
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request body
    const validationResult = boardingPassSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: validationResult.error.issues 
      });
    }

    const boardingPassData = {
      ...validationResult.data,
      id: Date.now().toString(), // Generate unique ID
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    logger.info({ boardingPassData }, 'Creating boarding pass');

    const { data, error } = await supabase
      .from('boarding_passes')
      .insert(boardingPassData)
      .select()
      .single();

    if (error) {
      logger.error({ error, boardingPassData }, 'Failed to create boarding pass');
      
      // Handle specific Supabase errors
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Booking ID already exists' });
      }
      if (error.code === '23514') {
        return res.status(400).json({ error: 'Invalid data provided' });
      }
      if (error.code === '42P01') {
        return res.status(500).json({ error: 'Database table not found' });
      }
      
      return res.status(500).json({ error: 'Failed to create boarding pass' });
    }

    logger.info({ boardingPassId: data.id }, 'Boarding pass created successfully');
    res.status(201).json({ data });
  } catch (err) {
    logger.error({ err }, 'Error creating boarding pass');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/boarding-passes/:id/status - Update boarding pass status
router.patch('/:id/status', async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.headers.authorization?.replace('Bearer ', '');
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request body
    const validationResult = updateStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        details: validationResult.error.issues 
      });
    }

    const { status } = validationResult.data;

    const { data, error } = await supabase
      .from('boarding_passes')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Boarding pass not found' });
      }
      logger.error({ error }, 'Failed to update boarding pass status');
      return res.status(500).json({ error: 'Failed to update status' });
    }

    logger.info({ boardingPassId: id, status }, 'Boarding pass status updated');
    res.json({ data });
  } catch (err) {
    logger.error({ err }, 'Error updating boarding pass status');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/boarding-passes/:id - Cancel boarding pass
router.delete('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.headers.authorization?.replace('Bearer ', '');
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Instead of deleting, we'll mark as cancelled
    const { data, error } = await supabase
      .from('boarding_passes')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Boarding pass not found' });
      }
      logger.error({ error }, 'Failed to cancel boarding pass');
      return res.status(500).json({ error: 'Failed to cancel boarding pass' });
    }

    logger.info({ boardingPassId: id }, 'Boarding pass cancelled');
    res.json({ data });
  } catch (err) {
    logger.error({ err }, 'Error cancelling boarding pass');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;