export interface EventItem {
    event: string;
    raw_subject: string;
    time: string;
    context: string;
    sender: string;
    urgency: string;
    
  }


export const TodayIcon: React.FC = () => {
  const day = new Date().getDate();           // 1-31
  return (
    <span style={{
      display: 'inline-block',
      width: 24, height: 24,
      position: 'relative',
      fontSize: 12,
      fontWeight: 700,
      lineHeight: '24px',
      textAlign: 'center',
      background: '#e0e0e0',
      borderRadius: 4,
    }}>
      {day}
      {/* little calendar “ring” */}
      <span style={{
        position: 'absolute',
        top: -4,
        left: 4,
        width: 16, height: 4,
        background: '#4285F4',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4
      }} />
    </span>
  );
};
