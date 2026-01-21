import { supabase } from './supabase';

export async function seedDatabase() {
  try {
    const sampleVideos = [
      {
        title: 'Introduction to Kizomba',
        description: 'Learn the basics of kizomba dance and understand its cultural roots. Perfect for complete beginners.',
        level: 'beginner',
        duration_minutes: 15,
        order_index: 1,
        is_free: true,
        thumbnail_url: '',
        video_url: '',
      },
      {
        title: 'Basic Steps and Rhythm',
        description: 'Master the fundamental steps and develop your sense of rhythm in kizomba.',
        level: 'beginner',
        duration_minutes: 20,
        order_index: 2,
        is_free: true,
        thumbnail_url: '',
        video_url: '',
      },
      {
        title: 'Connection and Frame',
        description: 'Understand the importance of connection and maintaining proper frame in partner dancing.',
        level: 'beginner',
        duration_minutes: 18,
        order_index: 3,
        is_free: false,
        thumbnail_url: '',
        video_url: '',
      },
      {
        title: 'Intermediate Turns',
        description: 'Advance your skills with elegant turns and rotations.',
        level: 'intermediate',
        duration_minutes: 25,
        order_index: 1,
        is_free: false,
        thumbnail_url: '',
        video_url: '',
      },
      {
        title: 'Leading and Following',
        description: 'Develop advanced leading and following techniques for smooth dancing.',
        level: 'intermediate',
        duration_minutes: 22,
        order_index: 2,
        is_free: false,
        thumbnail_url: '',
        video_url: '',
      },
      {
        title: 'Complex Patterns',
        description: 'Learn intricate patterns and combinations for advanced dancers.',
        level: 'advanced',
        duration_minutes: 30,
        order_index: 1,
        is_free: false,
        thumbnail_url: '',
        video_url: '',
      },
      {
        title: 'Musical Interpretation',
        description: 'Master the art of interpreting kizomba music and expressing it through dance.',
        level: 'advanced',
        duration_minutes: 28,
        order_index: 2,
        is_free: false,
        thumbnail_url: '',
        video_url: '',
      },
    ];

    const { data: videos, error: videoError } = await supabase
      .from('videos')
      .insert(sampleVideos)
      .select();

    if (videoError) {
      console.error('Error seeding videos:', videoError);
      return { success: false, error: videoError };
    }

    console.log('Sample data created successfully!');
    return { success: true, videos };
  } catch (error) {
    console.error('Error seeding database:', error);
    return { success: false, error };
  }
}
