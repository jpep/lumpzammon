{/* Top half */}
<div style={{ display: 'flex' }}>
  <div style={{ display: 'flex' }}>
    {renderHalf(TOP_IDX.slice(0, 6), true)}
  </div>
  {/* Joueur 2 en haut */}
  <BarZone
    bar={bar}
    player={2}
    onClickBar={onClickBar}
    selectedFrom={selectedFrom}
    animatingFrom={animatingFrom}
    animatingPlayer={animatingPlayer}
  />
  <div style={{ display: 'flex' }}>
    {renderHalf(TOP_IDX.slice(7), true)}
  </div>
  <div data-point-id="off-2" onClick={offHighlight ? onClickOff : undefined}
    style={{
      width: 50,
      background: offHighlight ? theme.bgBearoffActive : theme.bgBearoff,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      padding: 4, cursor: offHighlight ? 'pointer' : 'default', gap: 2,
    }}>
    {off[2] > 0 && (
      <div style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
        {off[2]}
      </div>
    )}
  </div>
</div>

{/* Bottom half */}
<div style={{ display: 'flex' }}>
  <div style={{ display: 'flex' }}>
    {renderHalf(BOT_IDX.slice(0, 6), false)}
  </div>
  {/* Joueur 1 en bas */}
  <BarZone
    bar={bar}
    player={1}
    onClickBar={onClickBar}
    selectedFrom={selectedFrom}
    animatingFrom={animatingFrom}
    animatingPlayer={animatingPlayer}
  />
  <div style={{ display: 'flex' }}>
    {renderHalf(BOT_IDX.slice(7), false)}
  </div>
  <div data-point-id="off-1" onClick={offHighlight ? onClickOff : undefined}
    style={{
      width: 50,
      background: offHighlight ? theme.bgBearoffActive : theme.bgBearoff,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
      padding: 4, cursor: offHighlight ? 'pointer' : 'default', gap: 2,
    }}>
    {off[1] > 0 && (
      <div style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
        {off[1]}
      </div>
    )}
  </div>
</div>
