import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, colors, Field, money, styles } from './ui';
import { TeamLogo } from './FootballUI';

type Trade = { title:string; opposite:string; side:string; contracts:number; cost_cents:number };
type Group = { id:string; name:string; memberCount:number };

export function SharePlaySheet({trade,groups,recipients,note,busy,error,onNote,onToggle,onClose,onShare}:{
  trade:Trade|null; groups:Group[]; recipients:string[]; note:string; busy:boolean; error:React.ReactNode;
  onNote:(value:string)=>void; onToggle:(id:string)=>void; onClose:()=>void; onShare:()=>void;
}) {
  const insets=useSafeAreaInsets();
  const title=trade?.side==='yes'?trade.title:trade?.opposite;
  return <Modal visible={!!trade} transparent animationType="slide" onRequestClose={()=>{if(!busy)onClose();}}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss share sheet" disabled={busy} onPress={onClose}/>
      <View accessibilityViewIsModal style={[s.sheet,{paddingBottom:Math.max(insets.bottom,16),maxHeight:Platform.OS==='web'?'90%':'92%'}]}>
        <View style={s.handle}/>
        <View style={s.header}><Text accessibilityRole="header" style={[styles.title,{fontSize:27,flex:1}]}>Share your play</Text><Pressable accessibilityRole="button" accessibilityLabel="Close share sheet" disabled={busy} onPress={onClose} style={s.close}><Text style={{fontSize:27,color:colors.muted}}>×</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:16}}>
          {error}
          {trade&&<View style={s.pick}><Text style={styles.label}>YOUR PLAY · PRACTICE BUY</Text><View style={s.pickRow}><TeamLogo name={title||''} size={40}/><View style={{flex:1,gap:4}}><Text style={[styles.heading,{fontSize:18}]}>{title}</Text><Text style={styles.muted}>{trade.contracts} contracts · {money(trade.cost_cents)}</Text></View></View></View>}
          <Text style={s.section}>Send to your groups</Text>
          {groups.map(g=>{const selected=recipients.includes(g.id);const disabled=busy||(!selected&&recipients.length>=10);return <Pressable key={g.id} accessibilityRole="checkbox" accessibilityLabel={g.name} accessibilityState={{checked:selected,disabled}} disabled={disabled} onPress={()=>onToggle(g.id)} style={[s.group,{opacity:disabled?.5:1}]}><View style={s.avatar}><Text style={styles.heading}>{g.name.trim()[0]?.toUpperCase()||'G'}</Text></View><View style={{flex:1,gap:3}}><Text style={[styles.text,{fontWeight:'600'}]}>{g.name}</Text><Text style={styles.muted}>{g.memberCount} {g.memberCount===1?'member':'members'}</Text></View><View style={[s.check,selected&&s.checked]}>{selected&&<Text style={{color:colors.card,fontWeight:'700'}}>✓</Text>}</View></Pressable>;})}
          {!groups.length&&<Text style={styles.text}>Create or join a group to share. Your play is saved in your history.</Text>}
          {groups.length>10&&<Text style={[styles.muted,{marginTop:10}]}>Choose up to 10 groups.</Text>}
          <View style={{marginTop:18}}><Field label="Add your take (optional)" value={note} onChangeText={onNote} editable={!busy} multiline maxLength={500} placeholder="Why do you like this play?"/></View>
        </ScrollView>
        <Button title={busy?'Sharing…':`Share to ${recipients.length} ${recipients.length===1?'group':'groups'} ↗`} disabled={busy||!recipients.length} onPress={onShare}/>
        <Text style={s.hint}>Shared to group chat · No additional order placed</Text>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s=StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'#442f2266'},
  sheet:{backgroundColor:colors.card,borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:20,paddingTop:12,width:'100%',maxWidth:480,alignSelf:'center'},
  handle:{width:36,height:4,borderRadius:2,backgroundColor:colors.border,alignSelf:'center',marginBottom:14},
  header:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:16},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  pick:{backgroundColor:colors.bg,borderWidth:1,borderColor:colors.border,borderRadius:18,padding:16,gap:12},pickRow:{flexDirection:'row',alignItems:'center',gap:12},
  section:{fontSize:15,fontWeight:'600',color:colors.text,marginTop:22,marginBottom:4},
  group:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,borderBottomWidth:1,borderBottomColor:colors.border},
  avatar:{width:42,height:42,borderRadius:15,backgroundColor:colors.avatar,alignItems:'center',justifyContent:'center'},
  check:{width:22,height:22,borderRadius:7,borderWidth:1,borderColor:colors.muted,alignItems:'center',justifyContent:'center'},checked:{backgroundColor:colors.text,borderColor:colors.text},
  hint:{fontSize:11,color:colors.muted,textAlign:'center',marginTop:12},
});
