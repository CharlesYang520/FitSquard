import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { LEGAL, type LegalDoc } from '../../legal'
import './index.scss'

export default function LegalPage() {
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  useLoad((q) => {
    const d = LEGAL[(q?.doc as keyof typeof LEGAL) ?? 'terms'] ?? LEGAL.terms
    setDoc(d)
    Taro.setNavigationBarTitle({ title: d.title })
  })
  if (!doc) return null
  return (
    <View className='page lg'>
      <View className='t-h1'>{doc.title}</View>
      {doc.sections.map((s, i) => (
        <View key={i} className='lg__sec'>
          {s.h && <View className='lg__h'>{s.h}</View>}
          {s.p.map((p, j) => (
            <Text key={j} className='lg__p'>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}
