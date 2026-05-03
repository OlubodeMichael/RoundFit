import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { ExerciseSection, Intensity, WorkoutType } from './types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const WORKOUT_TYPES: { id: WorkoutType; label: string; icon: IoniconName }[] = [
  { id: 'strength', label: 'Strength', icon: 'barbell-outline' },
  { id: 'run', label: 'Run', icon: 'footsteps-outline' },
  { id: 'cardio', label: 'Cardio', icon: 'heart-outline' },
  { id: 'hiit', label: 'HIIT', icon: 'flash-outline' },
  { id: 'yoga', label: 'Yoga', icon: 'leaf-outline' },
  { id: 'other', label: 'Other', icon: 'apps-outline' },
];

export const INTENSITY_OPTIONS: { id: Intensity; label: string; dots: number }[] = [
  { id: 'low', label: 'Low', dots: 1 },
  { id: 'moderate', label: 'Moderate', dots: 2 },
  { id: 'high', label: 'High', dots: 3 },
  { id: 'max', label: 'Max', dots: 4 },
];

export const CALORIES_PER_MINUTE: Record<Intensity, number> = {
  low: 4,
  moderate: 7,
  high: 10,
  max: 13,
};

export const EXERCISE_LIBRARY: Record<WorkoutType, ExerciseSection[]> = {
  strength: [
    {
      category: 'Chest',
      exercises: [
        'Bench Press', 'Incline Bench Press', 'Decline Bench Press',
        'Dumbbell Fly', 'Cable Fly', 'Incline Dumbbell Press',
        'Push-Ups', 'Chest Dips', 'Pec Deck', 'Landmine Press',
        'Close-Grip Bench', 'Cable Crossover',
      ],
    },
    {
      category: 'Back',
      exercises: [
        'Deadlift', 'Pull-Ups', 'Chin-Ups', 'Bent-Over Row',
        'Lat Pulldown', 'Seated Cable Row', 'T-Bar Row', 'Face Pull',
        'Single-Arm Dumbbell Row', 'Good Morning', 'Hyperextension',
        'Inverted Row', 'Meadows Row', 'Chest-Supported Row',
      ],
    },
    {
      category: 'Legs',
      exercises: [
        'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Leg Press',
        'Walking Lunges', 'Reverse Lunges', 'Bulgarian Split Squat',
        'Hip Thrust', 'Leg Extension', 'Leg Curl', 'Calf Raise',
        'Hack Squat', 'Step-Ups', 'Sumo Squat', 'Goblet Squat',
        'Glute Bridge', 'Nordic Curl',
      ],
    },
    {
      category: 'Shoulders',
      exercises: [
        'Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press',
        'Lateral Raise', 'Cable Lateral Raise', 'Front Raise',
        'Rear Delt Fly', 'Shrugs', 'Upright Row', 'Push Press',
        'Face Pull', 'Cable Rear Delt Fly',
      ],
    },
    {
      category: 'Arms',
      exercises: [
        'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl',
        'Concentration Curl', 'Cable Curl', 'Incline Dumbbell Curl',
        'Tricep Dip', 'Skull Crusher', 'Tricep Pushdown',
        'Overhead Tricep Extension', 'Diamond Push-Ups',
        'Cable Kickback', 'Tate Press',
      ],
    },
    {
      category: 'Core',
      exercises: [
        'Plank', 'Side Plank', 'Crunches', 'Bicycle Crunches',
        'Russian Twist', 'Leg Raise', 'Hanging Leg Raise',
        'Ab Rollout', 'Cable Crunch', 'Dead Bug', 'V-Ups',
        'Pallof Press', 'Dragon Flag', 'Hollow Body Hold',
        'Windshield Wipers',
      ],
    },
  ],

  run: [
    {
      category: 'Easy',
      exercises: [
        'Easy Run', 'Recovery Run', 'Base Run',
        'Long Slow Run', 'Conversational Pace Run',
      ],
    },
    {
      category: 'Distance',
      exercises: [
        '5K Run', '10K Run', '15K Run',
        'Half Marathon Pace', 'Marathon Pace', 'Ultra Pace',
      ],
    },
    {
      category: 'Speed',
      exercises: [
        'Sprint Intervals', 'Tempo Run', 'Fartlek',
        '400m Repeats', '800m Repeats', '1-Mile Repeats',
        'Strides', 'Hill Sprints',
      ],
    },
    {
      category: 'Terrain',
      exercises: [
        'Trail Run', 'Hill Run', 'Track Run',
        'Beach Run', 'Treadmill Run', 'Treadmill Incline Walk',
      ],
    },
  ],

  cardio: [
    {
      category: 'Machine',
      exercises: [
        'Treadmill', 'Stationary Bike', 'Rowing Machine',
        'Elliptical', 'Stair Climber', 'Ski Erg',
        'Assault Bike', 'Recumbent Bike', 'Hand Cycle',
      ],
    },
    {
      category: 'Outdoor',
      exercises: [
        'Cycling', 'Road Cycling', 'Mountain Biking',
        'Swimming Laps', 'Open Water Swim', 'Jump Rope',
        'Kayaking', 'Hiking', 'Nordic Walking',
      ],
    },
    {
      category: 'Sport',
      exercises: [
        'Basketball', 'Soccer', 'Tennis', 'Pickleball',
        'Volleyball', 'Racquetball', 'Squash',
        'Flag Football', 'Ultimate Frisbee',
      ],
    },
    {
      category: 'Low Impact',
      exercises: [
        'Pool Walking', 'Aqua Aerobics', 'Recumbent Cycling',
        'Rowing (Light)', 'Tai Chi Walk', 'Gentle Swim',
      ],
    },
  ],

  hiit: [
    {
      category: 'Plyometric',
      exercises: [
        'Box Jumps', 'Jump Squats', 'Jump Lunges',
        'Tuck Jumps', 'Broad Jumps', 'Depth Drops',
        'Lateral Bounds', 'Single-Leg Hops',
      ],
    },
    {
      category: 'Full Body',
      exercises: [
        'Burpees', 'Thrusters', 'Kettlebell Swings',
        'Battle Ropes', 'Bear Crawl', 'Devil Press',
        'Sandbag Clean', 'Dumbbell Snatch', 'Man Makers',
      ],
    },
    {
      category: 'Cardio Bursts',
      exercises: [
        'Sprint', 'High Knees', 'Jumping Jacks',
        'Mountain Climbers', 'Plank Jacks', 'Butt Kicks',
        'Skaters', 'Star Jumps', 'Speed Skaters',
      ],
    },
    {
      category: 'Core HIIT',
      exercises: [
        'V-Ups', 'Hollow Body Hold', 'Flutter Kicks',
        'Bicycle Crunches', 'Toe Touches', 'Windshield Wipers',
        'Plank to Pike', 'Spiderman Plank',
      ],
    },
    {
      category: 'Upper Body',
      exercises: [
        'Push-Up Variations', 'Renegade Rows', 'Pike Push-Ups',
        'Plyo Push-Ups', 'Dumbbell Shoulder Press', 'Pull-Up Negatives',
      ],
    },
  ],

  yoga: [
    {
      category: 'Standing',
      exercises: [
        'Mountain Pose', 'Warrior I', 'Warrior II', 'Warrior III',
        'Triangle Pose', 'Tree Pose', 'Chair Pose',
        'Crescent Lunge', 'Goddess Pose', 'Eagle Pose',
        'Revolved Triangle', 'Half Moon Pose',
      ],
    },
    {
      category: 'Floor',
      exercises: [
        "Child's Pose", 'Downward Dog', 'Upward Dog', 'Cobra Pose',
        'Pigeon Pose', 'Seated Forward Fold', 'Bridge Pose',
        'Boat Pose', 'Happy Baby', 'Cat-Cow',
        'Supine Twist', 'Legs Up the Wall',
      ],
    },
    {
      category: 'Balance',
      exercises: [
        'Crow Pose', "Dancer's Pose", 'Side Crow',
        'Headstand', 'Shoulder Stand', 'Handstand',
        'Firefly Pose', 'Flying Pigeon',
      ],
    },
    {
      category: 'Flow',
      exercises: [
        'Sun Salutation A', 'Sun Salutation B', 'Vinyasa Flow',
        'Yin Sequence', 'Power Flow', 'Restorative Flow',
        'Hip Opener Flow', 'Backbend Flow', 'Twist Sequence',
      ],
    },
  ],

  other: [
    {
      category: 'Functional',
      exercises: [
        'CrossFit WOD', 'Kettlebell Circuit', 'TRX Training',
        'Resistance Band Circuit', 'Bodyweight Circuit',
        'Animal Flow', 'Sandbag Training', 'Sled Push',
        'Sled Pull', 'Farmers Carry', 'Tire Flip',
      ],
    },
    {
      category: 'Flexibility & Recovery',
      exercises: [
        'Full-Body Stretch', 'Foam Rolling', 'Mobility Drills',
        'PNF Stretching', 'Dynamic Warm-Up', 'Cryotherapy Session',
        'Sauna', 'Massage',
      ],
    },
    {
      category: 'Sport & Activity',
      exercises: [
        'Rock Climbing', 'Bouldering', 'Boxing', 'Kickboxing',
        'Muay Thai', 'BJJ', 'Wrestling', 'Dance',
        'Gymnastics', 'Parkour', 'Cheerleading',
      ],
    },
    {
      category: 'Mindful Movement',
      exercises: [
        'Pilates', 'Barre', 'Tai Chi', 'Qigong',
        'Feldenkrais', 'Meditation Walk', 'Breathwork',
      ],
    },
  ],
};
