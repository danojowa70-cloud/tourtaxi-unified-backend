import express, { Request, Response } from 'express';
import supabase from '../config/supabase';
import { logger } from '../utils/logger';

const router = express.Router();

// Dashboard Stats
router.get('/dashboard/stats', async (_req: Request, res: Response) => {
  try {
    // Get active drivers count
    const { count: driversCount } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true });

    // Get online drivers
    const { count: onlineDrivers } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true);

    // Get active passengers count
    const { count: passengersCount } = await supabase
      .from('passengers')
      .select('*', { count: 'exact', head: true });

    // Get ongoing rides
    const { count: ongoingRides } = await supabase
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .in('status', ['accepted', 'started']);

    // Get completed rides today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: completedToday } = await supabase
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString());

    // Get total revenue
    const { data: revenueData } = await supabase
      .from('rides')
      .select('fare')
      .eq('status', 'completed');

    const totalRevenue = revenueData?.reduce((sum, ride) => sum + (ride.fare || 0), 0) || 0;

    // Get today's revenue
    const { data: todayRevenueData } = await supabase
      .from('rides')
      .select('fare')
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString());

    const todayRevenue = todayRevenueData?.reduce((sum, ride) => sum + (ride.fare || 0), 0) || 0;

    // Get average rating
    const { data: ratingsData } = await supabase
      .from('rides')
      .select('driver_rating')
      .eq('status', 'completed')
      .not('driver_rating', 'is', null);

    const averageRating = ratingsData && ratingsData.length > 0
      ? ratingsData.reduce((sum, ride) => sum + (ride.driver_rating || 0), 0) / ratingsData.length
      : 0;

    // Get peak hours (rides by hour)
    const { data: ridesData } = await supabase
      .from('rides')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    const peakHours = Array.from({ length: 24 }, (_, hour) => {
      const count = ridesData?.filter(ride => {
        const rideHour = new Date(ride.created_at).getHours();
        return rideHour === hour;
      }).length || 0;
      return { hour, rides: count };
    });

    res.json({
      activeDrivers: driversCount || 0,
      onlineDrivers: onlineDrivers || 0,
      activePassengers: passengersCount || 0,
      ongoingRides: ongoingRides || 0,
      completedToday: completedToday || 0,
      totalRevenue,
      todayRevenue,
      averageRating,
      peakHours,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching dashboard stats');
    res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
  }
});

// Revenue Data (last 7 days)
router.get('/dashboard/revenue', async (_req: Request, res: Response) => {
  try {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const revenueData = await Promise.all(
      last7Days.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { data: rides } = await supabase
          .from('rides')
          .select('fare')
          .eq('status', 'completed')
          .gte('completed_at', date.toISOString())
          .lt('completed_at', nextDay.toISOString());

        const revenue = rides?.reduce((sum, ride) => sum + (ride.fare || 0), 0) || 0;
        const ridesCount = rides?.length || 0;

        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue,
          rides: ridesCount,
        };
      })
    );

    res.json(revenueData);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching revenue data');
    res.status(500).json({ error: 'Failed to fetch revenue data', details: error.message });
  }
});

// Driver Earnings
router.get('/financial/driver-earnings', async (_req: Request, res: Response) => {
  try {
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name, total_earnings, total_rides');

    if (!drivers) {
      return res.json([]);
    }

    const earningsData = drivers.map(driver => ({
      driverId: driver.id,
      driverName: driver.name,
      totalEarnings: driver.total_earnings || 0,
      pendingPayout: (driver.total_earnings || 0) * 0.3, // 30% pending
      rides: driver.total_rides || 0,
    }));

    // Sort by total earnings
    earningsData.sort((a, b) => b.totalEarnings - a.totalEarnings);

    res.json(earningsData);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching driver earnings');
    res.status(500).json({ error: 'Failed to fetch driver earnings', details: error.message });
  }
});

// Analytics Metrics
router.get('/analytics/metrics', async (_req: Request, res: Response) => {
  try {
    const { data: rides } = await supabase
      .from('rides')
      .select('status, duration, distance, fare');

    const totalRides = rides?.length || 0;
    const completedRides = rides?.filter(r => r.status === 'completed') || [];

    const completionRate = totalRides > 0
      ? (completedRides.length / totalRides) * 100
      : 0;

    const avgTripDuration = completedRides.length > 0
      ? completedRides.reduce((sum, r) => sum + (r.duration || 0), 0) / completedRides.length
      : 0;

    const avgDistance = completedRides.length > 0
      ? completedRides.reduce((sum, r) => sum + (r.distance || 0), 0) / completedRides.length
      : 0;

    const revenuePerRide = completedRides.length > 0
      ? completedRides.reduce((sum, r) => sum + (r.fare || 0), 0) / completedRides.length
      : 0;

    res.json({
      completionRate,
      avgTripDuration,
      avgDistance,
      revenuePerRide,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching analytics metrics');
    res.status(500).json({ error: 'Failed to fetch analytics metrics', details: error.message });
  }
});

// User Growth (last 6 months)
router.get('/analytics/user-growth', async (_req: Request, res: Response) => {
  try {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return date;
    });

    const growthData = await Promise.all(
      last6Months.map(async (date) => {
        const { count: driversCount } = await supabase
          .from('drivers')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', date.toISOString());

        const { count: passengersCount } = await supabase
          .from('passengers')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', date.toISOString());

        return {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          drivers: driversCount || 0,
          passengers: passengersCount || 0,
        };
      })
    );

    res.json(growthData);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching user growth');
    res.status(500).json({ error: 'Failed to fetch user growth', details: error.message });
  }
});

// Ride Status Breakdown
router.get('/analytics/ride-status', async (_req: Request, res: Response) => {
  try {
    const { data: rides } = await supabase
      .from('rides')
      .select('status');

    const breakdown = {
      requested: 0,
      accepted: 0,
      started: 0,
      completed: 0,
      cancelled: 0,
    };

    rides?.forEach(ride => {
      const status = ride.status as keyof typeof breakdown;
      if (status in breakdown) {
        breakdown[status]++;
      }
    });

    res.json(breakdown);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching ride status breakdown');
    res.status(500).json({ error: 'Failed to fetch ride status breakdown', details: error.message });
  }
});

// Get all drivers (with full details)
router.get('/drivers', async (_req: Request, res: Response) => {
  try {
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(drivers || []);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching drivers');
    res.status(500).json({ error: 'Failed to fetch drivers', details: error.message });
  }
});

// Get all passengers (with full details)
router.get('/passengers', async (_req: Request, res: Response) => {
  try {
    const { data: passengers, error } = await supabase
      .from('passengers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(passengers || []);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching passengers');
    res.status(500).json({ error: 'Failed to fetch passengers', details: error.message });
  }
});

// Get all rides (with full details)
router.get('/rides', async (_req: Request, res: Response) => {
  try {
    const { data: rides, error } = await supabase
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    res.json(rides || []);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching rides');
    res.status(500).json({ error: 'Failed to fetch rides', details: error.message });
  }
});

// Get all reviews
router.get('/reviews', async (_req: Request, res: Response) => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(reviews || []);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching reviews');
    res.status(500).json({ error: 'Failed to fetch reviews', details: error.message });
  }
});

// Get all notifications
router.get('/notifications', async (_req: Request, res: Response) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(notifications || []);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching notifications');
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
});

// Create notification
router.post('/notifications', async (req: Request, res: Response) => {
  try {
    const { title, message, targetType, targetIds } = req.body;

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title,
        message,
        target_type: targetType,
        target_ids: targetIds || [],
        status: 'sent',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error: any) {
    logger.error({ error }, 'Error creating notification');
    res.status(500).json({ error: 'Failed to create notification', details: error.message });
  }
});

// Get all support tickets
router.get('/support', async (_req: Request, res: Response) => {
  try {
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(tickets || []);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching support tickets');
    res.status(500).json({ error: 'Failed to fetch support tickets', details: error.message });
  }
});

// Update support ticket
router.patch('/support/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.status === 'resolved' && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    logger.error({ error }, 'Error updating support ticket');
    res.status(500).json({ error: 'Failed to update support ticket', details: error.message });
  }
});

// Get all zones
router.get('/zones', async (_req: Request, res: Response) => {
  try {
    const { data: zones, error } = await supabase
      .from('zones')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.json(zones || []);
  } catch (error: any) {
    logger.error({ error }, 'Error fetching zones');
    res.status(500).json({ error: 'Failed to fetch zones', details: error.message });
  }
});

// Update zone
router.patch('/zones/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('zones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    logger.error({ error }, 'Error updating zone');
    res.status(500).json({ error: 'Failed to update zone', details: error.message });
  }
});

// Update driver
router.patch('/drivers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('drivers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    logger.error({ error }, 'Error updating driver');
    res.status(500).json({ error: 'Failed to update driver', details: error.message });
  }
});

// Update ride
router.patch('/rides/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('rides')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    logger.error({ error }, 'Error updating ride');
    res.status(500).json({ error: 'Failed to update ride', details: error.message });
  }
});

export default router;
