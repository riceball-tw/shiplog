import { use } from 'echarts/core'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, LineChart, ScatterChart, DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer])
