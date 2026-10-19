// Photos from Unsplash (Unsplash License), resized for the app. Tone is what's under the status bar.
export type Photo = {
  source: number
  tone: 'dark' | 'light' | 'split'
  title: string
  credit: string
}

export const photos: Photo[] = [
  {
    source: require('../assets/photos/p184.jpg'),
    tone: 'dark',
    title: 'Dunes at night',
    credit: 'Tim de Groot',
  },
  {
    source: require('../assets/photos/p119.jpg'),
    tone: 'light',
    title: 'White desk',
    credit: 'Nadir Balcikli',
  },
  {
    source: require('../assets/photos/p274.jpg'),
    tone: 'dark',
    title: 'Times Square',
    credit: 'Wojtek Witkowski',
  },
  {
    source: require('../assets/photos/p244.jpg'),
    tone: 'light',
    title: 'Pier',
    credit: 'Yair Hazout',
  },
  {
    source: require('../assets/photos/p192.jpg'),
    tone: 'dark',
    title: 'Reading room',
    credit: 'Adam Przewoski',
  },
  {
    source: require('../assets/photos/p37.jpg'),
    tone: 'light',
    title: 'Coastline',
    credit: 'Austin Neill',
  },
  {
    source: require('../assets/photos/p306.jpg'),
    tone: 'dark',
    title: 'Water lily',
    credit: 'Schicka',
  },
  {
    source: require('../assets/photos/p133.jpg'),
    tone: 'light',
    title: 'Yellow doors',
    credit: 'Dietmar Becker',
  },
  {
    source: require('../assets/photos/p325.jpg'),
    tone: 'split',
    title: 'Summer dress',
    credit: 'Dominik Martin',
  },
  {
    source: require('../assets/photos/p429.jpg'),
    tone: 'split',
    title: 'Raspberries',
    credit: 'Glen Carrie',
  },
  {
    source: require('../assets/photos/p431.jpg'),
    tone: 'split',
    title: 'Coffee',
    credit: 'Carli Jean',
  },
  {
    source: require('../assets/photos/p103.jpg'),
    tone: 'light',
    title: 'Afternoon',
    credit: 'Ilham Rahmansyah',
  },
]
