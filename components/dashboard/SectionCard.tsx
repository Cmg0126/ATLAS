interface Props {
    title:string;
    children:React.ReactNode;
}

export default function SectionCard({title,children}:Props){

    return(

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">

            <h2 className="font-bold text-xl mb-6">

                {title}

            </h2>

            {children}

        </div>

    )

}