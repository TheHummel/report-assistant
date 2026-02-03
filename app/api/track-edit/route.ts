import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasUnlimitedEdits } from '@/lib/paywall';
import type { TablesInsert, TablesUpdate } from '@/database.types';
import { MONTHLY_EDIT_LIMIT } from '@/lib/constants';

type UsageSlice = {
  edit_count: number;
  monthly_edit_count: number;
  daily_reset_date: string | null;
  monthly_reset_date: string | null;
};

// GET handler to check edit limits without incrementing
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasUnlimitedUser = hasUnlimitedEdits(user.email);

    // Fetch user usage data
    const usageRes = await supabase
      .from('user_usage' as const)
      .select(
        'edit_count, monthly_edit_count, daily_reset_date, monthly_reset_date'
      )
      .eq('user_id', user.id)
      .single();
    const usageData = usageRes.data as UsageSlice | null;
    const usageError = usageRes.error;

    // If no usage record exists, create one
    if (usageError && usageError.code === 'PGRST116') {
      const newUsagePayload: TablesInsert<'user_usage'> = {
        user_id: user.id,
        edit_count: 0,
        monthly_edit_count: 0,
        daily_reset_date: new Date().toISOString().split('T')[0],
        monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      };

      const newUsageRes =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('user_usage') as any)
          .insert(newUsagePayload)
          .select('edit_count, monthly_edit_count, monthly_reset_date')
          .single();
      const newUsageData = newUsageRes.data as UsageSlice | null;
      const createError = newUsageRes.error;

      if (createError) {
        console.error('Error creating user_usage record:', createError);
        return NextResponse.json(
          { error: 'Failed to create usage record' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        canEdit: true,
        editCount: 0,
        monthlyEditCount: 0,
        limit: hasUnlimitedUser ? null : MONTHLY_EDIT_LIMIT,
        monthlyLimit: hasUnlimitedUser ? null : MONTHLY_EDIT_LIMIT,
        monthlyResetDate: newUsageData?.monthly_reset_date ?? null,
        hasUnlimitedEdits: hasUnlimitedUser,
      });
    }

    if (usageError) {
      console.error('Error fetching usage data:', usageError);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    // Check if monthly reset is needed
    if (usageData && usageData.monthly_reset_date) {
      const resetDate = new Date(usageData.monthly_reset_date);
      const currentDate = new Date();

      if (currentDate >= resetDate) {
        // Reset monthly count
        const resetPayload: TablesUpdate<'user_usage'> = {
          monthly_edit_count: 0,
          monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        };
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('user_usage') as any)
          .update(resetPayload)
          .eq('user_id', user.id);

        usageData.monthly_edit_count = 0;
      }
    }

    const monthlyEditCount = usageData?.monthly_edit_count ?? 0;
    const canEdit = hasUnlimitedUser || monthlyEditCount < MONTHLY_EDIT_LIMIT;

    return NextResponse.json({
      canEdit,
      editCount: usageData?.edit_count ?? 0,
      monthlyEditCount,
      limit: hasUnlimitedUser ? null : MONTHLY_EDIT_LIMIT,
      monthlyLimit: hasUnlimitedUser ? null : MONTHLY_EDIT_LIMIT,
      monthlyResetDate: usageData?.monthly_reset_date ?? null,
      hasUnlimitedEdits: hasUnlimitedUser,
    });
  } catch (error) {
    console.error('Error fetching edit limits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch edit limits' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasUnlimitedUser = hasUnlimitedEdits(user.email);

    // First, ensure user has a usage record
    const initialRes = await supabase
      .from('user_usage' as const)
      .select(
        'edit_count, monthly_edit_count, daily_reset_date, monthly_reset_date'
      )
      .eq('user_id', user.id)
      .single();
    let usageData = initialRes.data as UsageSlice | null;
    const usageError = initialRes.error;

    // If no usage record exists, create one
    if (usageError && usageError.code === 'PGRST116') {
      console.log('Creating new user_usage record for user:', user.id);

      const newUsagePayload: TablesInsert<'user_usage'> = {
        user_id: user.id,
        edit_count: 0,
        monthly_edit_count: 0,
        daily_reset_date: new Date().toISOString().split('T')[0],
        monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      };

      const newUsageRes =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('user_usage') as any)
          .insert(newUsagePayload)
          .select(
            'edit_count, monthly_edit_count, daily_reset_date, monthly_reset_date'
          )
          .single();
      const newUsageData = newUsageRes.data as UsageSlice | null;
      const createError = newUsageRes.error;

      if (createError) {
        console.error('Error creating user_usage record:', createError);
        return NextResponse.json(
          { error: 'Failed to create usage record' },
          { status: 500 }
        );
      }

      usageData = newUsageData;
    } else if (usageError) {
      console.error('Error fetching usage data:', usageError);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    // Check if monthly reset is needed
    if (usageData && usageData.monthly_reset_date) {
      const resetDate = new Date(usageData.monthly_reset_date);
      const currentDate = new Date();

      if (currentDate >= resetDate) {
        // Reset monthly count
        const resetPayload: TablesUpdate<'user_usage'> = {
          monthly_edit_count: 0,
          monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        };
        const resetRes =
          await // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('user_usage') as any)
            .update(resetPayload)
            .eq('user_id', user.id);

        if (!resetRes.error && usageData) {
          usageData.monthly_edit_count = 0;
        }
      }
    }

    // Increment edit count
    const updatePayload: TablesUpdate<'user_usage'> = {
      edit_count: (usageData?.edit_count ?? 0) + 1,
      monthly_edit_count: (usageData?.monthly_edit_count ?? 0) + 1,
    };

    const updateRes =
      await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('user_usage') as any)
        .update(updatePayload)
        .eq('user_id', user.id)
        .select('edit_count, monthly_edit_count, monthly_reset_date')
        .single();

    if (updateRes.error) {
      console.error('Error updating user usage data:', updateRes.error);
      return NextResponse.json(
        { error: 'Failed to update usage data' },
        { status: 500 }
      );
    }

    const updatedUsageData = updateRes.data as UsageSlice | null;
    const monthlyEditCount = updatedUsageData?.monthly_edit_count ?? 0;
    const remainingEdits = hasUnlimitedUser
      ? null
      : Math.max(0, MONTHLY_EDIT_LIMIT - monthlyEditCount);
    const canEdit = hasUnlimitedUser || monthlyEditCount < MONTHLY_EDIT_LIMIT;

    return NextResponse.json({
      success: true,
      canEdit,
      remainingEdits,
      remainingMonthlyEdits: remainingEdits,
      editCount: updatedUsageData?.edit_count ?? 0,
      monthlyEditCount,
      limitReached: !canEdit,
      monthlyLimitReached: hasUnlimitedUser
        ? false
        : monthlyEditCount >= MONTHLY_EDIT_LIMIT,
      monthlyResetDate: updatedUsageData?.monthly_reset_date ?? null,
      hasUnlimitedEdits: hasUnlimitedUser,
    });
  } catch (error) {
    console.error('Error tracking edit:', error);
    return NextResponse.json(
      { error: 'Failed to track edit' },
      { status: 500 }
    );
  }
}
